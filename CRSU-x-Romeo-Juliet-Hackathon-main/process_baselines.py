import json
import csv
from pathlib import Path

def process():
    baselines = [
        ('Greedy', 'results/greedy.json'),
        ('No-Clarification', 'results/no_asks.json'),
        ('Random-Feasible', 'results/random.json')
    ]
    
    rows = []
    summary_rows = []
    
    for name, path_str in baselines:
        p = Path(path_str)
        if not p.exists():
            print(f"Waiting for {path_str}...")
            return False
        data = json.loads(p.read_text())
        for ep in data['episodes']:
            rows.append({
                'Baseline': name,
                'Scenario': ep['variant'],
                'Seed': ep['seed'],
                'Arrived_Members': ep['arrived_members'],
                'Served_Members': ep['served_members'],
                'Unserved_Members': ep['unserved_members'],
                'Coverage': f"{ep['coverage']*100:.1f}%",
                'Assignments': ep['assignments'],
                'Mutual_Acceptances': ep['mutual_acceptances'],
                'Mutual_Accept_per_100': f"{ep['mutual_acceptances_per_100']:.1f}",
                'Dates': ep['dates'],
                'MSMI': ep['mutual_second_meeting_intention'],
                'MSMI_per_100': f"{ep['msmi_per_100_arrived_members']:.2f}",
                'Clarification_Cost': ep['ask_cost'],
                'Inference_Seconds': f"{ep['inference_seconds']:.2f}"
            })
            
        summary = data['summary']
        summary_rows.append({
            'Baseline': name,
            'Primary_Score_MSMI_per_100': f"{summary['primary_score']:.2f}",
            'Overall_Coverage': f"{summary['overall']['coverage']*100:.1f}%",
            'Overall_Mutual_Accept_per_100': f"{summary['overall']['mutual_acceptances_per_100']:.2f}",
            'Overall_Ask_Cost': f"{summary['overall']['ask_cost']:.1f}",
            'Overall_Inference_Sec': f"{summary['overall']['inference_seconds']:.2f}"
        })
        
    out_csv = Path('results/baseline_comparison.csv')
    with out_csv.open('w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} scenario records to {out_csv}")
    
    # Print formatted markdown table
    print("\n### Scenario-Level Baseline Comparison\n")
    headers = ['Baseline', 'Scenario', 'MSMI', 'MSMI/100', 'Coverage', 'Ask Cost', 'Mutual Accept', 'Dates', 'Inference (s)']
    print(f"| {' | '.join(headers)} |")
    print(f"|{'|'.join(['---']*len(headers))}|")
    for r in rows:
        print(f"| {r['Baseline']} | {r['Scenario']} | {r['MSMI']} | {r['MSMI_per_100']} | {r['Coverage']} | {r['Clarification_Cost']} | {r['Mutual_Acceptances']} | {r['Dates']} | {r['Inference_Seconds']} |")
        
    print("\n### Overall Baseline Summary\n")
    s_headers = ['Baseline', 'Primary Score (MSMI/100)', 'Coverage', 'Mutual Accept/100', 'Ask Cost', 'Inference (s)']
    print(f"| {' | '.join(s_headers)} |")
    print(f"|{'|'.join(['---']*len(s_headers))}|")
    for sr in summary_rows:
        print(f"| {sr['Baseline']} | {sr['Primary_Score_MSMI_per_100']} | {sr['Overall_Coverage']} | {sr['Overall_Mutual_Accept_per_100']} | {sr['Overall_Ask_Cost']} | {sr['Overall_Inference_Sec']} |")
        
    return True

if __name__ == '__main__':
    process()
