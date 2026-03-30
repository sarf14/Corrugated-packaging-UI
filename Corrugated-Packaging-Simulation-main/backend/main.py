from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import io

from engine import CorrugatedSimulation

import os

app = FastAPI(title="Corrugated Simulation API")

# Enable CORS for frontend integration
origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEFAULT_EXCEL_PATH = "corrugated_factory_config.xlsx"
DEEPSEEK_API_KEY = "sk-84b78e39161d49e081bb04d0fcc99fd9"


# ── Alert Generation ──────────────────────────────────────────────────────────

def generate_alerts(results: dict, machine_stats: dict, batch_metrics_df, wip_timeline_df) -> list:
    alerts = []
    idx = 1

    for machine, stats in machine_stats.items():
        down = stats.get("down_time", 0)
        if down > 30:
            alerts.append({"id": f"A-{idx:03d}", "severity": "critical", "category": "jam",
                "title": f"Severe Jam Downtime on {machine}",
                "description": f"{machine} accumulated {round(down,1)} mins of Weibull-distributed jam downtime. MTTR exceeded threshold.",
                "machine": machine, "timestamp": f"Sim T+{round(down):.0f} min"})
        elif down > 5:
            alerts.append({"id": f"A-{idx:03d}", "severity": "warning", "category": "jam",
                "title": f"Jam Event Detected on {machine}",
                "description": f"{machine} spent {round(down,1)} mins in failure/repair state.",
                "machine": machine, "timestamp": f"Sim T+{round(down):.0f} min"})
        idx += 1

    for machine, stats in machine_stats.items():
        starved = stats.get("starved_time", 0)
        if starved > 20:
            alerts.append({"id": f"A-{idx:03d}", "severity": "critical", "category": "starvation",
                "title": f"Severe Forklift Starvation: {machine}",
                "description": f"{machine} waited {round(starved,1)} mins for forklift delivery.",
                "machine": machine, "timestamp": "WIP Phase"})
        elif starved > 5:
            alerts.append({"id": f"A-{idx:03d}", "severity": "warning", "category": "starvation",
                "title": f"Forklift Starvation: {machine}",
                "description": f"{machine} starved {round(starved,1)} mins waiting on forklift logistics.",
                "machine": machine, "timestamp": "WIP Phase"})
        idx += 1

    for machine, stats in machine_stats.items():
        blocked = stats.get("blocked_time", 0)
        if blocked > 15:
            alerts.append({"id": f"A-{idx:03d}", "severity": "critical", "category": "bottleneck",
                "title": f"Downstream Blocking Bottleneck: {machine}",
                "description": f"{machine} was BLOCKED for {round(blocked,1)} mins — downstream buffer full. Cascades upstream.",
                "machine": machine, "timestamp": "Run Phase"})
        elif blocked > 2:
            alerts.append({"id": f"A-{idx:03d}", "severity": "warning", "category": "bottleneck",
                "title": f"Downstream Blocking Detected: {machine}",
                "description": f"{machine} blocked for {round(blocked,1)} mins waiting downstream.",
                "machine": machine, "timestamp": "Run Phase"})
        idx += 1

    if not batch_metrics_df.empty and "Flow_Time" in batch_metrics_df.columns:
        avg_flow = batch_metrics_df["Flow_Time"].mean()
        slow = batch_metrics_df[batch_metrics_df["Flow_Time"] > avg_flow * 2]
        if not slow.empty:
            s = slow.sort_values("Flow_Time", ascending=False).iloc[0]
            alerts.append({"id": f"A-{idx:03d}", "severity": "warning", "category": "throughput",
                "title": f"Slow Batch Detected",
                "description": f"Batch {s.get('Batch_ID','?')} ({s.get('Job_Type','?')}) took {round(s['Flow_Time'],1)} mins — {round(s['Flow_Time']/avg_flow,1)}x avg.",
                "timestamp": f"Ended T+{round(s.get('End_Time',0)):.0f}"})
        idx += 1

    if not wip_timeline_df.empty and "Global_WIP" in wip_timeline_df.columns:
        max_wip = wip_timeline_df["Global_WIP"].max()
        if max_wip > 15:
            alerts.append({"id": f"A-{idx:03d}", "severity": "critical", "category": "wip",
                "title": "WIP Overload Detected",
                "description": f"Factory WIP peaked at {int(max_wip)} concurrent batches — severe congestion.",
                "timestamp": "Peak WIP"})
        elif max_wip > 8:
            alerts.append({"id": f"A-{idx:03d}", "severity": "warning", "category": "wip",
                "title": "High WIP Warning",
                "description": f"Factory WIP reached {int(max_wip)} batches (threshold: 8).",
                "timestamp": "Peak WIP"})
        idx += 1

    total_completed = sum(results["Completed_Jobs"].values())
    alerts.append({"id": f"A-{idx:03d}", "severity": "info", "category": "throughput",
        "title": "Simulation Run Completed",
        "description": f"Total output: {total_completed:,} boxes in {round(results['Total_Time'],1)} mins. {len(batch_metrics_df)} batches processed.",
        "timestamp": f"T={round(results['Total_Time'],1)} min"})

    return alerts


# ── Simulation Runner ─────────────────────────────────────────────────────────

def run_simulation(excel_bytes: bytes = None, num_runs: int = 1):
    if excel_bytes:
        machines_df = pd.read_excel(io.BytesIO(excel_bytes), sheet_name='Machines')
        jobs_df = pd.read_excel(io.BytesIO(excel_bytes), sheet_name='Jobs')
        routings_df = pd.read_excel(io.BytesIO(excel_bytes), sheet_name='Routings')
    else:
        machines_df = pd.read_excel(DEFAULT_EXCEL_PATH, sheet_name='Machines')
        jobs_df = pd.read_excel(DEFAULT_EXCEL_PATH, sheet_name='Jobs')
        routings_df = pd.read_excel(DEFAULT_EXCEL_PATH, sheet_name='Routings')

    # Apply normalization to make upload robust to column naming variations
    machines_df = normalize_df(machines_df, MACHINE_MAP)
    jobs_df = normalize_df(jobs_df, JOB_MAP)
    routings_df = normalize_df(routings_df, ROUTING_MAP)

    # SECURE DEFAULTS: Ensure Count and Buffer are at least 1
    if "Count" in machines_df.columns:
        machines_df["Count"] = machines_df["Count"].apply(lambda x: max(1, int(x)) if pd.notnull(x) else 1)
    if "Input_Buffer_Capacity" in machines_df.columns:
        machines_df["Input_Buffer_Capacity"] = machines_df["Input_Buffer_Capacity"].apply(lambda x: max(1, int(x)) if pd.notnull(x) else 10)

    num_runs = max(1, int(num_runs))
    all_results = []

    for _ in range(num_runs):
        sim = CorrugatedSimulation(machines_df, jobs_df, routings_df, forklift_count=2)
        all_results.append(sim.run())

    # --- Average numeric machine stats across runs ---
    avg_machine_stats = {}
    all_machine_ids = all_results[0]["Machine_Stats"].keys()
    numeric_stat_keys = ["working_time", "setup_time", "blocked_time", "starved_time",
                         "down_time", "completed_operations", "buffer_wip_area", "average_wip"]
    for m_id in all_machine_ids:
        avg_machine_stats[m_id] = {}
        for k in numeric_stat_keys:
            vals = [r["Machine_Stats"].get(m_id, {}).get(k, 0) for r in all_results]
            avg_machine_stats[m_id][k] = round(sum(vals) / len(vals), 3)

    # Average completed jobs
    avg_completed = {}
    for job in all_results[0]["Completed_Jobs"]:
        vals = [r["Completed_Jobs"].get(job, 0) for r in all_results]
        avg_completed[job] = round(sum(vals) / len(vals))

    # Average total time
    avg_total_time = sum(r["Total_Time"] for r in all_results) / len(all_results)

    # Use WIP/Batch/State from the median-time run (most representative single run)
    times = [r["Total_Time"] for r in all_results]
    median_time = sorted(times)[len(times) // 2]
    rep_run = min(all_results, key=lambda r: abs(r["Total_Time"] - median_time))

    wip_df = rep_run["WIP_Timeline"]
    batch_df = rep_run["Batch_Metrics"]
    state_df = rep_run["State_Timeline"]

    machine_state_agg = {}
    if not state_df.empty and "Machine" in state_df.columns:
        for machine_id, grp in state_df.groupby("Machine"):
            grp = grp.sort_values("Time").reset_index(drop=True)
            totals = {"Processing": 0, "Setup": 0, "Starved": 0, "Blocked": 0, "Failed": 0, "Idle": 0}
            for i in range(len(grp) - 1):
                dt = grp.loc[i+1, "Time"] - grp.loc[i, "Time"]
                for col in totals:
                    if col in grp.columns:
                        totals[col] += grp.loc[i, col] * dt
            machine_state_agg[machine_id] = totals

    # Build synthetic averaged results for alert generation
    avg_results = {
        "Total_Time": avg_total_time,
        "Completed_Jobs": avg_completed,
        "Machine_Stats": avg_machine_stats,
    }
    alerts = generate_alerts(avg_results, avg_machine_stats, batch_df, wip_df)

    return {
        "Total_Time": avg_total_time,
        "Completed_Jobs": avg_completed,
        "Machine_Stats": avg_machine_stats,
        "Machine_State_Agg": machine_state_agg,
        "WIP_Timeline": wip_df.to_dict(orient='records'),
        "State_Timeline": state_df.to_dict(orient='records'),
        "Batch_Metrics": batch_df.to_dict(orient='records'),
        "Alerts": alerts,
        "Num_Runs": num_runs,
    }


# ── API Endpoints ─────────────────────────────────────────────────────────────

@app.get("/api/simulate/default")
async def get_default_simulation():
    try:
        data = run_simulation()
        return {"status": "success", "data": data}
    except Exception as e:
        import traceback
        return {"status": "error", "message": str(e), "trace": traceback.format_exc()}


@app.post("/api/simulate")
async def run_custom_simulation(file: UploadFile = File(None), num_runs: int = Form(1)):
    try:
        contents = await file.read() if file else None
        data = run_simulation(excel_bytes=contents, num_runs=num_runs)
        return {"status": "success", "data": data}
    except Exception as e:
        import traceback
        return {"status": "error", "message": str(e), "trace": traceback.format_exc()}


@app.get("/api/config")
async def get_config():
    """Return the current default config as JSON for frontend editing."""
    try:
        machines_df = pd.read_excel(DEFAULT_EXCEL_PATH, sheet_name='Machines')
        jobs_df = pd.read_excel(DEFAULT_EXCEL_PATH, sheet_name='Jobs')
        routings_df = pd.read_excel(DEFAULT_EXCEL_PATH, sheet_name='Routings')
        return {
            "status": "success",
            "data": {
                "machines": machines_df.to_dict(orient='records'),
                "jobs": jobs_df.to_dict(orient='records'),
                "routings": routings_df.to_dict(orient='records'),
            }
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/api/config/upload")
async def get_config_from_upload(file: UploadFile = File(...)):
    """Parse an uploaded Excel file and return its config without running a simulation."""
    try:
        contents = await file.read()
        machines_df = pd.read_excel(io.BytesIO(contents), sheet_name='Machines')
        jobs_df = pd.read_excel(io.BytesIO(contents), sheet_name='Jobs')
        routings_df = pd.read_excel(io.BytesIO(contents), sheet_name='Routings')
        machines_df = normalize_df(machines_df, MACHINE_MAP)
        jobs_df = normalize_df(jobs_df, JOB_MAP)
        routings_df = normalize_df(routings_df, ROUTING_MAP)
        return {
            "status": "success",
            "data": {
                "machines": machines_df.to_dict(orient='records'),
                "jobs": jobs_df.to_dict(orient='records'),
                "routings": routings_df.to_dict(orient='records'),
            }
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


def normalize_df(df: pd.DataFrame, mapping: dict) -> pd.DataFrame:
    """Standardize AI-generated dataframe columns to canonical names."""
    if df.empty:
        return df
    
    new_cols = {}
    for col in df.columns:
        clean_col = str(col).lower().replace(" ", "_").replace("-", "_").strip()
        for canonical, variants in mapping.items():
            if clean_col == canonical.lower().replace(" ", "_").replace("-", "_") or \
               clean_col in [v.lower().replace(" ", "_").replace("-", "_") for v in variants]:
                new_cols[col] = canonical
                break
    
    # Special fallbacks for ID and Type
    if "Machine_ID" not in new_cols.values():
        for col in df.columns:
            c = str(col).lower()
            if "id" in c and "machine" in c: new_cols[col] = "Machine_ID"
    
    return df.rename(columns=new_cols)

# Canonical column names for our engine
MACHINE_MAP = {
    "Machine_ID": ["id", "machine_id", "machineId", "machine_name", "machine", "name", "machine id"],
    "Machine_Type": ["type", "machine_type", "category", "machine type"],
    "Count": ["capacity", "count", "num_units", "quantity", "units"],
    "Input_Buffer_Capacity": ["buffer", "buffer_size", "input_buffer", "buffer capacity"],
    "Jam_Weibull_Alpha": ["alpha", "jam_alpha", "weibull_alpha"],
    "Jam_Weibull_Beta": ["beta", "jam_beta", "weibull_beta"],
    "Repair_Lognormal_Mu": ["mu", "repair_mu", "lognormal_mu"],
    "Repair_Lognormal_Sigma": ["sigma", "repair_sigma", "lognormal_sigma"]
}

JOB_MAP = {
    "Job_Type": ["type", "job_type", "jobType", "job_id", "job type", "job"],
    "Batch_Size": ["batch_size", "size", "units_per_batch", "batch size"],
    "Target_Demand": ["demand", "target_demand", "total_units", "target demand"],
    "Interarrival_Min": ["min_arrival", "arrival_min", "interarrival min"],
    "Interarrival_Max": ["max_arrival", "arrival_max", "interarrival max"]
}

ROUTING_MAP = {
    "Job_Type": ["type", "job_type", "jobType", "job type", "job"],
    "Sequence_Order": ["order", "sequence", "step", "sequence order"],
    "Machine_ID": ["machine", "machine_id", "id", "machine id"],
    "Setup_Time_Base": ["setup", "setup_time", "base_setup", "setup base"],
    "Setup_Time_Std": ["setup_std", "setup_variance", "setup std"],
    "Process_Time_Per_Unit": ["process_time", "time_per_unit", "process time"],
    "Requires_Forklift": ["forklift", "needs_forklift", "requires forklift"]
}


@app.post("/api/simulate/json")
async def run_json_simulation(payload: dict):
    """
    Accept machine/job/routing delta as JSON and run simulation.
    Uses DEFAULT_EXCEL_PATH as the baseline and overlays changes.
    """
    try:
        # 1. Load Baseline from Source of Truth (Excel)
        m_base = pd.read_excel(DEFAULT_EXCEL_PATH, sheet_name='Machines')
        j_base = pd.read_excel(DEFAULT_EXCEL_PATH, sheet_name='Jobs')
        r_base = pd.read_excel(DEFAULT_EXCEL_PATH, sheet_name='Routings')

        # 2. Overlay Machines
        machines_data = payload.get("machines")
        if machines_data:
            print(f"DEBUG: Overlaying {len(machines_data)} machine changes...")
            m_overlay = normalize_df(pd.DataFrame(machines_data), MACHINE_MAP)
            if "Machine_ID" in m_overlay.columns:
                m_base.set_index("Machine_ID", inplace=True)
                m_overlay.set_index("Machine_ID", inplace=True)
                m_base.update(m_overlay) # Update existing by ID
                # Add any entirely new machines
                new_m = m_overlay[~m_overlay.index.isin(m_base.index)]
                m_base = pd.concat([m_base, new_m])
                m_base.reset_index(inplace=True)
            else:
                print("WARNING: Machine overlay missing Machine_ID column. Skipping overlay.")

        # 3. Overlay Jobs
        jobs_data = payload.get("jobs")
        if jobs_data:
            print(f"DEBUG: Overlaying {len(jobs_data)} job changes...")
            j_overlay = normalize_df(pd.DataFrame(jobs_data), JOB_MAP)
            if "Job_Type" in j_overlay.columns:
                j_base.set_index("Job_Type", inplace=True)
                j_overlay.set_index("Job_Type", inplace=True)
                j_base.update(j_overlay)
                new_j = j_overlay[~j_overlay.index.isin(j_base.index)]
                j_base = pd.concat([j_base, new_j])
                j_base.reset_index(inplace=True)

        # 4. Overlay Routings
        routings_data = payload.get("routings")
        if routings_data:
            print(f"DEBUG: Overlaying {len(routings_data)} routing steps...")
            r_overlay = normalize_df(pd.DataFrame(routings_data), ROUTING_MAP)
            if "Job_Type" in r_overlay.columns:
                # If AI sends routing for a job, replace ENTIRE old routing for that job
                affected_jobs = r_overlay["Job_Type"].unique()
                r_base = r_base[~r_base["Job_Type"].isin(affected_jobs)]
                r_base = pd.concat([r_base, r_overlay])
                r_base.sort_values(["Job_Type", "Sequence_Order"], inplace=True)

        # 4.5 Backend Safety: Final check for zero/negative values before engine starts
        m_base["Count"] = m_base["Count"].apply(lambda x: max(1, int(x)) if pd.notnull(x) else 1)
        r_base["Process_Time_Per_Unit"] = r_base["Process_Time_Per_Unit"].apply(lambda x: max(0.001, float(x)) if pd.notnull(x) else 0.1)

        # 5. Run 20 simulations and average for statistical reliability
        NUM_SANDBOX_RUNS = 20
        print(f"DEBUG: Running {NUM_SANDBOX_RUNS} sandbox simulations for statistical averaging...")
        all_results = []
        for _ in range(NUM_SANDBOX_RUNS):
            sim = CorrugatedSimulation(m_base, j_base, r_base, forklift_count=2)
            all_results.append(sim.run())

        # Average numeric machine stats
        avg_machine_stats = {}
        numeric_stat_keys = ["working_time", "setup_time", "blocked_time", "starved_time",
                             "down_time", "completed_operations", "buffer_wip_area", "average_wip"]
        for m_id in all_results[0]["Machine_Stats"].keys():
            avg_machine_stats[m_id] = {}
            for k in numeric_stat_keys:
                vals = [r["Machine_Stats"].get(m_id, {}).get(k, 0) for r in all_results]
                avg_machine_stats[m_id][k] = round(sum(vals) / len(vals), 3)

        # Average completed jobs and total time
        avg_completed = {}
        for job in all_results[0]["Completed_Jobs"]:
            vals = [r["Completed_Jobs"].get(job, 0) for r in all_results]
            avg_completed[job] = round(sum(vals) / len(vals))
        avg_total_time = sum(r["Total_Time"] for r in all_results) / len(all_results)

        # Use median-time run for WIP/Batch/State timelines
        times = [r["Total_Time"] for r in all_results]
        median_time = sorted(times)[len(times) // 2]
        rep_run = min(all_results, key=lambda r: abs(r["Total_Time"] - median_time))

        wip_df = rep_run["WIP_Timeline"]
        batch_df = rep_run["Batch_Metrics"]
        state_df = rep_run["State_Timeline"]

        machine_state_agg = {}
        if not state_df.empty and "Machine" in state_df.columns:
            for machine_id, grp in state_df.groupby("Machine"):
                grp = grp.sort_values("Time").reset_index(drop=True)
                totals = {"Processing": 0, "Setup": 0, "Starved": 0, "Blocked": 0, "Failed": 0, "Idle": 0}
                for i in range(len(grp) - 1):
                    dt = grp.loc[i+1, "Time"] - grp.loc[i, "Time"]
                    for col in totals:
                        if col in grp.columns:
                            totals[col] += grp.loc[i, col] * dt
                machine_state_agg[machine_id] = totals

        avg_results_obj = {"Total_Time": avg_total_time, "Completed_Jobs": avg_completed, "Machine_Stats": avg_machine_stats}
        alerts = generate_alerts(avg_results_obj, avg_machine_stats, batch_df, wip_df)

        return {
            "status": "success",
            "data": {
                "Total_Time": avg_total_time,
                "Completed_Jobs": avg_completed,
                "Machine_Stats": avg_machine_stats,
                "Machine_State_Agg": machine_state_agg,
                "WIP_Timeline": wip_df.to_dict(orient='records'),
                "State_Timeline": state_df.to_dict(orient='records'),
                "Batch_Metrics": batch_df.to_dict(orient='records'),
                "Alerts": alerts,
                "Num_Runs": NUM_SANDBOX_RUNS,
            }
        }
    except Exception as e:
        import traceback
        print(f"CRITICAL ERROR in JSON SIM: {e}")
        print(traceback.format_exc())
        return {"status": "error", "message": str(e), "trace": traceback.format_exc()}




# ── DeepSeek Chat ─────────────────────────────────────────────────────────────

def build_system_prompt(sim_summary: dict, current_config: dict = None, session_history: list = []) -> str:
    history_lines = []
    if session_history:
        for i, run in enumerate(session_history):
            m = run.get("metrics", {})
            history_lines.append(f"  - {run.get('label', f'Run {i+1}')}: Throughput={m.get('throughput', '0')} units, Time={m.get('time', '0')} mins, Top Bottleneck={m.get('bottleneck', 'N/A')}")
    history_section = "\n=== SESSION SIMULATION HISTORY (Past experiments in this session) ===\n" + "\n".join(history_lines) if history_lines else ""

    machine_stats = sim_summary.get("Machine_Stats", {})
    completed = sim_summary.get("Completed_Jobs", {})
    total_time = sim_summary.get("Total_Time", 0)
    alerts = sim_summary.get("Alerts", [])
    total_boxes = sum(completed.values()) if completed else 0
    sim_hours = round(total_time / 60, 1)

    machine_lines = []
    for m, s in machine_stats.items():
        working = round(s.get("working_time", 0), 1)
        setup = round(s.get("setup_time", 0), 1)
        blocked = round(s.get("blocked_time", 0), 1)
        starved = round(s.get("starved_time", 0), 1)
        down = round(s.get("down_time", 0), 1)
        util = round((working / total_time * 100), 1) if total_time > 0 else 0
        machine_lines.append(
            f"  - {m}: Utilization={util}%, Working={working}min, Setup={setup}min, "
            f"Blocked={blocked}min, Starved={starved}min, Jam/Downtime={down}min"
        )

    ranked_blocked = sorted(machine_stats.items(), key=lambda x: x[1].get("blocked_time", 0), reverse=True)
    blocked_rank = "\n".join([
        f"  #{i+1} {m}: {round(s.get('blocked_time', 0), 1)} mins BLOCKED"
        for i, (m, s) in enumerate(ranked_blocked)
    ])

    alert_lines = "\n".join([f"  [{a['severity'].upper()}] {a['title']}" for a in alerts])

    config_section = ""
    if current_config:
        machines = current_config.get("machines", [])
        m_list = "\n".join([
            f"    - {m['Machine_ID']}: type={m.get('Machine_Type','?')}, Count={m.get('Count', '?')}, Buffer={m.get('Input_Buffer_Capacity','?')}"
            for m in machines
        ])
        config_section = f"\n=== CURRENT FACTORY CONFIG (use these exact Machine_IDs and current Counts) ===\nMachines:\n{m_list}\n"
    
    return f"""You are an expert Factory Operations Analyst for a Corrugated Box manufacturing plant.
You have access to EXACT SimPy discrete-event simulation results modelling Weibull-distributed jams, forklift starvation, and multi-job routing.
{history_section}

=== SIMULATION SUMMARY ===
- Total Boxes Produced: {total_boxes:,}
- Job Breakdown: {completed}
- Makespan (Total Simulation Time): {round(total_time, 1)} mins ({sim_hours} hours)
- CURRENT FACTORY SETUP: {config_section}

=== MACHINE PERFORMANCE ===
{chr(10).join(machine_lines)}

=== BOTTLENECK RANKING (by BLOCKED time — downstream congestion) ===
{blocked_rank}

=== ALERTS GENERATED ===
{alert_lines}
{config_section}

WHAT-IF SCENARIOS (DELTA PROPOSALS):
If the user asks to change the factory (e.g., "Add a machine", "Increase capacity", "Add parallel machine"), you MUST propose a change.
IMPORTANT: You only need to send the DELTA (the specific items you changed). The backend will merge your changes into the existing factory config.

=== HOW TO ADD PARALLEL CAPACITY (CRITICAL) ===
The CORRECT way to add a parallel machine is to INCREMENT the "Count" on the EXISTING machine entry.
DO NOT create a new machine with a different name — the routing system does not support splitting jobs between two differently-named machines.

EXAMPLE — Adding a parallel Stitcher (going from 1 to 2 units):
[[PROPOSAL: {{
  "machines": [{{
    "Machine_ID": "Stitcher",
    "Count": 2
  }}]
}}]]

EXAMPLE — Adding a parallel Corrugator AND speeding up Sizer_Cutter:
[[PROPOSAL: {{
  "machines": [
    {{"Machine_ID": "Corrugator", "Count": 2}},
    {{"Machine_ID": "Sizer_Cutter", "Count": 2}}
  ]
}}]]

EXAMPLE — Changing a process time (reduce Stitcher's Process_Time_Per_Unit):
[[PROPOSAL: {{
  "routings": [{{
    "Job_Type": "Standard_Box",
    "Sequence_Order": 4,
    "Machine_ID": "Stitcher",
    "Process_Time_Per_Unit": 0.02
  }}]
}}]]

Rules for Proposals:
1. DELTA ONLY: Only include the arrays for what you actually changed.
2. PARALLEL = INCREMENT COUNT: Never add a new machine name for parallel capacity. Always change the "Count" of the existing machine.
3. CASING: Use EXACT casing for keys (e.g., "Machine_ID", "Job_Type", "Count").
4. REAL MACHINE IDs ONLY: Use Machine IDs exactly as they appear in the current config above. Never invent new machine names.
5. REALISM: Use realistic minutes for setup and process times.
6. DO NOT PREDICT NUMBERS: Do not state what the simulation time or throughput will be after the change. Only the sandbox will reveal that.

Always cite exact machine names and exact times in minutes from the data above. Be concise and data-driven."""


@app.post("/api/chat")
async def chat_with_simulation(payload: dict):
    """DeepSeek LLM chat with full simulation context and conversation history."""
    from openai import OpenAI

    question = payload.get("question", "")
    sim_summary = payload.get("sim_summary", {})
    history = payload.get("history", [])  # prior [{role, content}] turns
    current_config = payload.get("current_config", None)
    session_history = payload.get("session_history", [])

    system_prompt = build_system_prompt(sim_summary, current_config, session_history)

    messages = [{"role": "system", "content": system_prompt}]
    for turn in history:
        if turn.get("role") in ["user", "assistant"] and turn.get("content"):
            messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append({"role": "user", "content": question})

    try:
        client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url="https://api.deepseek.com")
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=messages,
            stream=False,
        )
        return {"reply": response.choices[0].message.content}
    except Exception as e:
        import traceback
        return {"reply": f"AI Error: {str(e)}", "trace": traceback.format_exc()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
