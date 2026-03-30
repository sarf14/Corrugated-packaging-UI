import pandas as pd

def apply_bottleneck_fix(input_path, output_path):
    print(f"Loading baseline from {input_path}...")
    
    # Read existing sheets
    try:
        machines_df = pd.read_excel(input_path, sheet_name='Machines')
        jobs_df = pd.read_excel(input_path, sheet_name='Jobs')
        routings_df = pd.read_excel(input_path, sheet_name='Routings')
    except Exception as e:
        print(f"Error loading sheets: {e}")
        return

    # Update Bundling capacity (1 -> 2)
    print("Updating 'Bundling' capacity from 1 to 2...")
    if 'Machine_ID' in machines_df.columns:
        machines_df.loc[machines_df['Machine_ID'] == 'Bundling', 'Count'] = 2
    else:
        print("Warning: Machine_ID column not found in Machines sheet.")

    # Update Custom_Punch_Box demand (15000 -> 20000)
    print("Updating 'Custom_Punch_Box' demand from 15,000 to 20,000...")
    if 'Job_Type' in jobs_df.columns:
        jobs_df.loc[jobs_df['Job_Type'] == 'Custom_Punch_Box', 'Target_Demand'] = 20000
    else:
        print("Warning: Job_Type column not found in Jobs sheet.")

    # Save to new file
    print(f"Saving optimized configuration to {output_path}...")
    with pd.ExcelWriter(output_path, engine='xlsxwriter') as writer:
        machines_df.to_excel(writer, sheet_name='Machines', index=False)
        jobs_df.to_excel(writer, sheet_name='Jobs', index=False)
        routings_df.to_excel(writer, sheet_name='Routings', index=False)
    
    print("Success! Optimized config generated.")

if __name__ == "__main__":
    baseline = "backend/corrugated_factory_config.xlsx"
    optimized = "backend/corrugated_factory_config_optimized.xlsx"
    apply_bottleneck_fix(baseline, optimized)
