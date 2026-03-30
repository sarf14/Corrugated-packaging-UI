"""
Generates an optimized factory config based on AI what-if analysis recommendations:

Machine Capacity Changes:
  - Stitcher:        Count 2 → 3
  - Slotter_Puncher: Count 2 → 3
  - Corrugator:      Count 1 → 2

Process Time Reductions:
  - Stitcher Process_Time_Per_Unit for Standard_Box:       → 0.045 min/unit
  - Slotter_Puncher Process_Time_Per_Unit for Custom_Punch_Box: → 0.048 min/unit

Setup Time Reduction:
  - Corrugator Setup_Time_Base: → 18 min

Run from the backend directory:
    python make_optimized_config.py

Output: corrugated_factory_config_OPTIMIZED.xlsx
"""
import pandas as pd

SRC  = "corrugated_factory_config.xlsx"
DEST = "corrugated_factory_config_OPTIMIZED.xlsx"

machines_df  = pd.read_excel(SRC, sheet_name="Machines")
jobs_df      = pd.read_excel(SRC, sheet_name="Jobs")
routings_df  = pd.read_excel(SRC, sheet_name="Routings")

print("=== MACHINES (original) ===")
print(machines_df[["Machine_ID", "Count"]].to_string(index=False))

# ── 1. Machine capacity changes ──────────────────────────────────────────────
capacity_changes = {
    "Stitcher":        3,
    "Slotter_Puncher": 3,
    "Corrugator":      2,
}
for machine_id, new_count in capacity_changes.items():
    mask = machines_df["Machine_ID"].str.strip() == machine_id
    if mask.any():
        old = machines_df.loc[mask, "Count"].values[0]
        machines_df.loc[mask, "Count"] = new_count
        print(f"  ✓ {machine_id} Count: {old} → {new_count}")
    else:
        print(f"  ⚠ WARNING: Machine '{machine_id}' not found — skipping")

print("\n=== MACHINES (modified) ===")
print(machines_df[["Machine_ID", "Count"]].to_string(index=False))

# ── 2. Process time reductions ───────────────────────────────────────────────
process_time_changes = [
    {"Machine_ID": "Stitcher",        "Job_Type": "Standard_Box",      "Process_Time_Per_Unit": 0.045},
    {"Machine_ID": "Slotter_Puncher", "Job_Type": "Custom_Punch_Box",  "Process_Time_Per_Unit": 0.048},
]
print("\n=== ROUTINGS — process time changes ===")
for change in process_time_changes:
    mask = (
        (routings_df["Machine_ID"].str.strip() == change["Machine_ID"]) &
        (routings_df["Job_Type"].str.strip() == change["Job_Type"])
    )
    if mask.any():
        old = routings_df.loc[mask, "Process_Time_Per_Unit"].values[0]
        routings_df.loc[mask, "Process_Time_Per_Unit"] = change["Process_Time_Per_Unit"]
        print(f"  ✓ {change['Machine_ID']} [{change['Job_Type']}] Process_Time_Per_Unit: {old} → {change['Process_Time_Per_Unit']}")
    else:
        print(f"  ⚠ WARNING: No routing row for {change['Machine_ID']} / {change['Job_Type']} — skipping")

# ── 3. Setup time reduction ───────────────────────────────────────────────────
print("\n=== ROUTINGS — setup time changes ===")
corrugator_mask = routings_df["Machine_ID"].str.strip() == "Corrugator"
if corrugator_mask.any():
    old_setup = routings_df.loc[corrugator_mask, "Setup_Time_Base"].values[0]
    routings_df.loc[corrugator_mask, "Setup_Time_Base"] = 18
    print(f"  ✓ Corrugator Setup_Time_Base: {old_setup} → 18")
else:
    print("  ⚠ WARNING: No Corrugator rows found in routings")

# ── 4. Save ───────────────────────────────────────────────────────────────────
with pd.ExcelWriter(DEST, engine="openpyxl") as writer:
    machines_df.to_excel(writer,  sheet_name="Machines",  index=False)
    jobs_df.to_excel(writer,      sheet_name="Jobs",       index=False)
    routings_df.to_excel(writer,  sheet_name="Routings",   index=False)

print(f"\n✅  Saved: {DEST}")
print("Upload this file in the Simulation Config panel to verify the optimized results.")
