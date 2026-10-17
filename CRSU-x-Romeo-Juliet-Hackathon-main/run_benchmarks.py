#!/usr/bin/env python3
"""
Stand-alone benchmark aggregator & visualizer.
Compares Our Model (submission) against official baselines (Greedy, Random-Feasible, No-Clarification)
and generates visual plots in results/.
"""
import json
from pathlib import Path
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

def main():
    results_dir = Path("results")
    baseline_csv = results_dir / "baseline_comparison.csv"
    submission_json = results_dir / "submission_eval.json"
    if not submission_json.exists():
        submission_json = results_dir / "evaluation_101.json"

    if not baseline_csv.exists():
        print(f"Error: {baseline_csv} not found.")
        return 1

    df_baselines = pd.read_csv(baseline_csv)
    records = []

    for _, row in df_baselines.iterrows():
        records.append({
            "Policy": row["Baseline"],
            "Scenario": row["Scenario"],
            "Seed": row["Seed"],
            "Arrived": row["Arrived_Members"],
            "Served": row["Served_Members"],
            "Coverage (%)": float(str(row["Coverage"]).replace('%', '')),
            "Mutual_Accept": row["Mutual_Acceptances"],
            "Mutual_Accept_per_100": row["Mutual_Accept_per_100"],
            "Dates": row["Dates"],
            "MSMI": row["MSMI"],
            "MSMI_per_100": row["MSMI_per_100"],
            "Cost": row["Clarification_Cost"],
            "Latency_s": row["Inference_Seconds"],
            "Safety_Valid": True
        })

    if submission_json.exists():
        with open(submission_json, 'r') as f:
            sub_data = json.load(f)
        for ep in sub_data.get("episodes", []):
            arrived = ep.get("arrived_members", 200)
            served = ep.get("served_members", 0)
            msmi = ep.get("mutual_second_meeting_intention", 0)
            records.append({
                "Policy": "Our Model (Global+EVOI)",
                "Scenario": ep.get("variant", "development"),
                "Seed": ep.get("seed", 101),
                "Arrived": arrived,
                "Served": served,
                "Coverage (%)": round((served / max(1, arrived)) * 100, 1),
                "Mutual_Accept": ep.get("mutual_acceptances", 0),
                "Mutual_Accept_per_100": ep.get("mutual_acceptances_per_100", 0.0),
                "Dates": ep.get("dates_attended", ep.get("dates", 0)),
                "MSMI": msmi,
                "MSMI_per_100": ep.get("msmi_per_100_arrived_members", round(100 * msmi / max(1, arrived), 2)),
                "Cost": ep.get("ask_cost", 0),
                "Latency_s": round(ep.get("inference_seconds", 0.0), 2),
                "Safety_Valid": ep.get("valid", True)
            })

    df = pd.DataFrame(records)

    print("\n" + "="*85)
    print("CRSU x ROMEO & JULIET HACKATHON · BENCHMARK EVALUATION SUMMARY")
    print("="*85)

    summary = df.groupby("Policy").agg({
        "MSMI_per_100": "mean",
        "MSMI": "sum",
        "Mutual_Accept_per_100": "mean",
        "Coverage (%)": "mean",
        "Dates": "sum",
        "Latency_s": "mean",
        "Safety_Valid": "all"
    }).reset_index()

    summary.columns = [
        "Policy", 
        "Primary Score (MSMI/100)", 
        "Total MSMI", 
        "Double Opt-In/100", 
        "Coverage (%)", 
        "Dates", 
        "Latency (s)", 
        "Safety Valid"
    ]
    summary = summary.sort_values(by="Primary Score (MSMI/100)", ascending=False)
    print(summary.to_string(index=False))
    print("="*85 + "\n")

    # Generate charts
    plt.rcParams.update({
        'font.family': 'sans-serif',
        'font.size': 10,
        'axes.edgecolor': '#c8bea9',
        'axes.grid': True,
        'grid.color': '#eae3d5',
        'figure.facecolor': '#fbf8f2',
        'axes.facecolor': '#ffffff'
    })

    # 1. MSMI by Scenario
    fig, ax = plt.subplots(figsize=(10, 5))
    scenarios = ["development", "sparse", "cold_start", "delayed", "shift", "drift"]
    policies = df["Policy"].unique()
    x = np.arange(len(scenarios))
    w = 0.8 / len(policies)
    palette = {
        "Our Model (Global+EVOI)": "#a13636",
        "Greedy": "#232536",
        "No-Clarification": "#9e978a",
        "Random-Feasible": "#b07d34"
    }

    for idx, pol in enumerate(policies):
        pol_df = df[df["Policy"] == pol].set_index("Scenario")
        vals = [pol_df.loc[s, "MSMI_per_100"] if s in pol_df.index else 0.0 for s in scenarios]
        color = palette.get(pol, "#385640")
        ax.bar(x + idx * w - (len(policies)-1)*w/2, vals, w, label=pol, color=color, edgecolor='#1a221d', linewidth=0.7)

    ax.set_ylabel("MSMI per 100 Arrived Members", fontweight='bold')
    ax.set_title("Primary Metric Across All 6 Challenge Scenarios", fontweight='bold', pad=12)
    ax.set_xticks(x)
    ax.set_xticklabels([s.title() for s in scenarios], fontweight='600')
    ax.legend(frameon=True, facecolor='#ffffff', edgecolor='#c8bea9')
    plt.tight_layout()
    chart1_path = results_dir / "msmi_comparison_chart.png"
    plt.savefig(chart1_path, dpi=200)
    plt.close()
    print(f"Saved scenario comparison chart to: {chart1_path}")

    # 2. Conversion Funnel
    fig, ax = plt.subplots(figsize=(9, 4.5))
    stages = ["Arrived", "Served", "Mutual Consent", "Dates Attended", "MSMI"]
    our_m = df[df["Policy"].str.contains("Our Model|submission", case=False)]
    greedy_m = df[df["Policy"] == "Greedy"]

    our_c = [our_m["Arrived"].sum(), our_m["Served"].sum(), our_m["Mutual_Accept"].sum(), our_m["Dates"].sum(), our_m["MSMI"].sum()]
    greedy_c = [greedy_m["Arrived"].sum(), greedy_m["Served"].sum(), greedy_m["Mutual_Accept"].sum(), greedy_m["Dates"].sum(), greedy_m["MSMI"].sum()]

    xf = np.arange(len(stages))
    bw = 0.35
    ax.bar(xf - bw/2, our_c, bw, label="Our Model (Global+EVOI)", color="#a13636", edgecolor="#1a221d")
    ax.bar(xf + bw/2, greedy_c, bw, label="Greedy Baseline", color="#232536", edgecolor="#1a221d")

    for i, v in enumerate(our_c):
        ax.text(i - bw/2, v + max(our_c)*0.015, str(int(v)), ha='center', fontweight='bold', fontsize=8.5)
    for i, v in enumerate(greedy_c):
        ax.text(i + bw/2, v + max(greedy_c)*0.015, str(int(v)), ha='center', fontsize=8.5)

    ax.set_ylabel("Total Candidates / Outcomes", fontweight='bold')
    ax.set_title("Conversion Funnel Comparison (Cumulative Across Scenarios)", fontweight='bold', pad=12)
    ax.set_xticks(xf)
    ax.set_xticklabels(stages, fontweight='600')
    ax.legend(frameon=True, facecolor='#ffffff', edgecolor='#c8bea9')
    plt.tight_layout()
    chart2_path = results_dir / "conversion_funnel.png"
    plt.savefig(chart2_path, dpi=200)
    plt.close()
    print(f"Saved conversion funnel chart to: {chart2_path}")

    return 0

if __name__ == "__main__":
    main()
