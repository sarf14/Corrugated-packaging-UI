"""
Quick utility: reads the default factory config and creates a modified version
with the Corrugator Count set to 2 — testing if CORRUGATOR is the real bottleneck.

Run from the backend directory:
    python make_stitcher2_config.py

Output: corrugated_factory_config_corrugator2.xlsx
"""
import pandas as pd

SRC  = "corrugated_factory_config.xlsx"
DEST = "corrugated_factory_config_corrugator2.xlsx"

machines_df = pd.read_excel(SRC, sheet_name="Machines")
jobs_df     = pd.read_excel(SRC, sheet_name="Jobs")
routings_df = pd.read_excel(SRC, sheet_name="Routings")

print("=== MACHINES (original) ===")
print(machines_df[["Machine_ID", "Count"]].to_string(index=False))

id_col = "Machine_ID"
mask = machines_df[id_col].str.strip() == "Corrugator"

if mask.any():
    old_count = machines_df.loc[mask, "Count"].values[0]
    machines_df.loc[mask, "Count"] = 2
    print(f"\n✓ Corrugator Count changed: {old_count} → 2")
else:
    print("\n⚠️  WARNING: Could not find 'Corrugator'. Machine IDs found:")
    print(machines_df[id_col].to_list())

print("\n=== MACHINES (modified) ===")
print(machines_df[["Machine_ID", "Count"]].to_string(index=False))

with pd.ExcelWriter(DEST, engine="openpyxl") as writer:
    machines_df.to_excel(writer, sheet_name="Machines", index=False)
    jobs_df.to_excel(writer,     sheet_name="Jobs",     index=False)
    routings_df.to_excel(writer, sheet_name="Routings", index=False)

print(f"\n✅  Saved: {DEST}")
print("Upload this file in the dashboard to test Corrugator as the real bottleneck.")
