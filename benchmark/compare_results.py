#!/usr/bin/env python3
"""
SWE-bench Results Comparison Tool

Compare evaluation results between vanilla Gemini Code and OMG-enhanced runs.
Generates detailed comparison reports in multiple formats.

Usage:
    python compare_results.py --vanilla results/vanilla/ --omg results/omg/
    python compare_results.py --vanilla results/vanilla/ --omg results/omg/ --output comparison/
"""

import argparse
import csv
import json
import logging
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def load_results(results_dir: Path) -> dict[str, Any]:
    """
    Load evaluation results from a results directory.

    Looks for:
    - summary.json (from evaluate.py)
    - predictions.json (for token/time metadata)
    - Individual instance results
    """
    results = {
        "instances": {},
        "total": 0,
        "passed": 0,
        "failed": 0,
        "pass_rate": 0.0,
        "metadata": {}
    }

    # Load summary if exists
    summary_file = results_dir / "summary.json"
    if summary_file.exists():
        with open(summary_file) as f:
            summary = json.load(f)
            results.update(summary)

    # Load predictions for metadata (try both JSONL and JSON formats)
    predictions_file = results_dir / "predictions.jsonl"
    if not predictions_file.exists():
        predictions_file = results_dir / "predictions.json"
    if not predictions_file.exists():
        # Try parent directory
        predictions_file = results_dir.parent / "predictions.jsonl"
        if not predictions_file.exists():
            predictions_file = results_dir.parent / "predictions.json"

    if predictions_file.exists():
        predictions = []
        with open(predictions_file) as f:
            content = f.read().strip()
            if content:
                # Try JSON first (most common case)
                try:
                    data = json.loads(content)
                    if isinstance(data, dict):
                        predictions = [{"instance_id": k, **v} for k, v in data.items()]
                    elif isinstance(data, list):
                        predictions = data
                except json.JSONDecodeError:
                    # Fall back to JSONL (one JSON object per line)
                    try:
                        for line in content.split('\n'):
                            if line.strip():
                                predictions.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass

        # Extract metadata per instance
        for pred in predictions:
            instance_id = pred.get("instance_id")
            if not instance_id:
                continue

            if instance_id not in results["instances"]:
                results["instances"][instance_id] = {}

            meta = results["instances"][instance_id]
            meta["tokens_input"] = pred.get("tokens_input", pred.get("input_tokens", 0))
            meta["tokens_output"] = pred.get("tokens_output", pred.get("output_tokens", 0))
            meta["tokens_total"] = meta.get("tokens_input", 0) + meta.get("tokens_output", 0)
            meta["time_seconds"] = pred.get("time_seconds", pred.get("duration", 0))
            meta["cost_usd"] = pred.get("cost_usd", pred.get("cost", 0))

    # Calculate aggregates
    total_tokens = sum(
        inst.get("tokens_total", 0)
        for inst in results["instances"].values()
    )
    total_time = sum(
        inst.get("time_seconds", 0)
        for inst in results["instances"].values()
    )
    total_cost = sum(
        inst.get("cost_usd", 0)
        for inst in results["instances"].values()
    )

    results["metadata"]["total_tokens"] = total_tokens
    results["metadata"]["total_time_seconds"] = total_time
    results["metadata"]["total_cost_usd"] = total_cost

    if results["total"] > 0:
        results["metadata"]["avg_tokens"] = total_tokens / results["total"]
        results["metadata"]["avg_time_seconds"] = total_time / results["total"]
        results["metadata"]["avg_cost_usd"] = total_cost / results["total"]

    return results


def compare_results(
    vanilla_results: dict[str, Any],
    omg_results: dict[str, Any]
) -> dict[str, Any]:
    """
    Compare vanilla and OMG results.

    Returns detailed comparison including:
    - Overall metrics comparison
    - Per-instance comparison
    - Improvement analysis
    """
    comparison = {
        "timestamp": datetime.now().isoformat(),
        "overall": {},
        "improvements": {},
        "regressions": {},
        "per_instance": {},
        "categories": defaultdict(lambda: {"vanilla": 0, "omg": 0})
    }

    # Overall comparison
    vanilla_pass = vanilla_results.get("passed", 0)
    omg_pass = omg_results.get("passed", 0)
    vanilla_total = vanilla_results.get("total", 0)
    omg_total = omg_results.get("total", 0)

    comparison["overall"] = {
        "vanilla": {
            "total": vanilla_total,
            "passed": vanilla_pass,
            "failed": vanilla_results.get("failed", 0),
            "pass_rate": vanilla_results.get("pass_rate", 0),
            "avg_tokens": vanilla_results.get("metadata", {}).get("avg_tokens", 0),
            "avg_time_seconds": vanilla_results.get("metadata", {}).get("avg_time_seconds", 0),
            "avg_cost_usd": vanilla_results.get("metadata", {}).get("avg_cost_usd", 0),
            "total_tokens": vanilla_results.get("metadata", {}).get("total_tokens", 0),
            "total_time_seconds": vanilla_results.get("metadata", {}).get("total_time_seconds", 0),
            "total_cost_usd": vanilla_results.get("metadata", {}).get("total_cost_usd", 0),
        },
        "omg": {
            "total": omg_total,
            "passed": omg_pass,
            "failed": omg_results.get("failed", 0),
            "pass_rate": omg_results.get("pass_rate", 0),
            "avg_tokens": omg_results.get("metadata", {}).get("avg_tokens", 0),
            "avg_time_seconds": omg_results.get("metadata", {}).get("avg_time_seconds", 0),
            "avg_cost_usd": omg_results.get("metadata", {}).get("avg_cost_usd", 0),
            "total_tokens": omg_results.get("metadata", {}).get("total_tokens", 0),
            "total_time_seconds": omg_results.get("metadata", {}).get("total_time_seconds", 0),
            "total_cost_usd": omg_results.get("metadata", {}).get("total_cost_usd", 0),
        },
        "delta": {
            "pass_rate": omg_results.get("pass_rate", 0) - vanilla_results.get("pass_rate", 0),
            "passed": omg_pass - vanilla_pass,
        }
    }

    # Calculate relative improvements
    if vanilla_pass > 0:
        comparison["overall"]["delta"]["pass_improvement_pct"] = (
            (omg_pass - vanilla_pass) / vanilla_pass * 100
        )
    else:
        comparison["overall"]["delta"]["pass_improvement_pct"] = 100.0 if omg_pass > 0 else 0.0

    vanilla_tokens = vanilla_results.get("metadata", {}).get("avg_tokens", 0)
    omg_tokens = omg_results.get("metadata", {}).get("avg_tokens", 0)
    if vanilla_tokens > 0:
        comparison["overall"]["delta"]["token_change_pct"] = (
            (omg_tokens - vanilla_tokens) / vanilla_tokens * 100
        )

    vanilla_time = vanilla_results.get("metadata", {}).get("avg_time_seconds", 0)
    omg_time = omg_results.get("metadata", {}).get("avg_time_seconds", 0)
    if vanilla_time > 0:
        comparison["overall"]["delta"]["time_change_pct"] = (
            (omg_time - vanilla_time) / vanilla_time * 100
        )

    # Per-instance comparison
    all_instances = set(vanilla_results.get("instances", {}).keys()) | \
                   set(omg_results.get("instances", {}).keys())

    improvements = []
    regressions = []

    for instance_id in all_instances:
        vanilla_inst = vanilla_results.get("instances", {}).get(instance_id, {})
        omg_inst = omg_results.get("instances", {}).get(instance_id, {})

        vanilla_status = vanilla_inst.get("status", "missing")
        omg_status = omg_inst.get("status", "missing")

        vanilla_passed = vanilla_status == "passed"
        omg_passed = omg_status == "passed"

        inst_comparison = {
            "instance_id": instance_id,
            "vanilla_status": vanilla_status,
            "omg_status": omg_status,
            "vanilla_tokens": vanilla_inst.get("tokens_total", 0),
            "omg_tokens": omg_inst.get("tokens_total", 0),
            "vanilla_time": vanilla_inst.get("time_seconds", 0),
            "omg_time": omg_inst.get("time_seconds", 0),
        }

        # Categorize change
        if not vanilla_passed and omg_passed:
            inst_comparison["change"] = "improvement"
            improvements.append(instance_id)
        elif vanilla_passed and not omg_passed:
            inst_comparison["change"] = "regression"
            regressions.append(instance_id)
        elif vanilla_passed and omg_passed:
            inst_comparison["change"] = "both_pass"
        else:
            inst_comparison["change"] = "both_fail"

        comparison["per_instance"][instance_id] = inst_comparison

        # Categorize by repo/category
        # Instance IDs are typically: repo__issue_number
        if "__" in instance_id:
            repo = instance_id.split("__")[0]
            if vanilla_passed:
                comparison["categories"][repo]["vanilla"] += 1
            if omg_passed:
                comparison["categories"][repo]["omg"] += 1

    comparison["improvements"] = {
        "count": len(improvements),
        "instances": improvements
    }
    comparison["regressions"] = {
        "count": len(regressions),
        "instances": regressions
    }

    # Convert defaultdict to regular dict for JSON serialization
    comparison["categories"] = dict(comparison["categories"])

    return comparison


def generate_markdown_report(comparison: dict[str, Any]) -> str:
    """Generate a detailed Markdown comparison report."""
    overall = comparison["overall"]
    vanilla = overall["vanilla"]
    omg = overall["omg"]
    delta = overall["delta"]

    lines = [
        "# SWE-bench Comparison Report: Vanilla vs OMG",
        "",
        f"**Generated:** {comparison['timestamp']}",
        "",
        "## Executive Summary",
        "",
    ]

    # Summary interpretation
    if delta["pass_rate"] > 0:
        lines.append(f"OMG improved pass rate by **{delta['pass_rate']:.1f} percentage points** "
                    f"({vanilla['pass_rate']:.1f}% -> {omg['pass_rate']:.1f}%).")
    elif delta["pass_rate"] < 0:
        lines.append(f"OMG decreased pass rate by **{abs(delta['pass_rate']):.1f} percentage points** "
                    f"({vanilla['pass_rate']:.1f}% -> {omg['pass_rate']:.1f}%).")
    else:
        lines.append("Pass rates are identical between vanilla and OMG.")

    lines.extend([
        "",
        f"- **Improvements:** {comparison['improvements']['count']} instances that vanilla failed but OMG passed",
        f"- **Regressions:** {comparison['regressions']['count']} instances that vanilla passed but OMG failed",
        "",
        "## Overall Metrics",
        "",
        "| Metric | Vanilla | OMG | Delta |",
        "|--------|---------|-----|-------|",
        f"| Total Instances | {vanilla['total']} | {omg['total']} | - |",
        f"| Passed | {vanilla['passed']} | {omg['passed']} | {delta['passed']:+d} |",
        f"| Failed | {vanilla['failed']} | {omg['failed']} | {omg['failed'] - vanilla['failed']:+d} |",
        f"| **Pass Rate** | **{vanilla['pass_rate']:.2f}%** | **{omg['pass_rate']:.2f}%** | **{delta['pass_rate']:+.2f}pp** |",
        "",
        "## Resource Usage",
        "",
        "| Metric | Vanilla | OMG | Change |",
        "|--------|---------|-----|--------|",
    ])

    # Token comparison
    token_change = delta.get("token_change_pct", 0)
    token_change_str = f"{token_change:+.1f}%" if token_change else "N/A"
    lines.append(f"| Avg Tokens/Instance | {vanilla['avg_tokens']:,.0f} | {omg['avg_tokens']:,.0f} | {token_change_str} |")

    # Time comparison
    time_change = delta.get("time_change_pct", 0)
    time_change_str = f"{time_change:+.1f}%" if time_change else "N/A"
    lines.append(f"| Avg Time/Instance | {vanilla['avg_time_seconds']:.1f}s | {omg['avg_time_seconds']:.1f}s | {time_change_str} |")

    # Cost comparison
    lines.append(f"| Total Cost | ${vanilla['total_cost_usd']:.2f} | ${omg['total_cost_usd']:.2f} | ${omg['total_cost_usd'] - vanilla['total_cost_usd']:+.2f} |")

    lines.extend([
        "",
        "## Improvements (Vanilla FAIL -> OMG PASS)",
        "",
    ])

    if comparison["improvements"]["instances"]:
        lines.append("| Instance ID |")
        lines.append("|-------------|")
        for inst_id in comparison["improvements"]["instances"][:20]:  # Limit to 20
            lines.append(f"| {inst_id} |")
        if len(comparison["improvements"]["instances"]) > 20:
            lines.append(f"| ... and {len(comparison['improvements']['instances']) - 20} more |")
    else:
        lines.append("*No improvements*")

    lines.extend([
        "",
        "## Regressions (Vanilla PASS -> OMG FAIL)",
        "",
    ])

    if comparison["regressions"]["instances"]:
        lines.append("| Instance ID |")
        lines.append("|-------------|")
        for inst_id in comparison["regressions"]["instances"]:
            lines.append(f"| {inst_id} |")
    else:
        lines.append("*No regressions*")

    # Category breakdown
    if comparison["categories"]:
        lines.extend([
            "",
            "## Per-Repository Breakdown",
            "",
            "| Repository | Vanilla Passed | OMG Passed | Delta |",
            "|------------|----------------|------------|-------|",
        ])

        for repo, counts in sorted(comparison["categories"].items()):
            delta_count = counts["omg"] - counts["vanilla"]
            lines.append(f"| {repo} | {counts['vanilla']} | {counts['omg']} | {delta_count:+d} |")

    lines.extend([
        "",
        "---",
        "",
        "*Report generated by compare_results.py*"
    ])

    return "\n".join(lines)


def generate_csv(comparison: dict[str, Any], output_file: Path):
    """Generate CSV file with per-instance comparison data."""
    fieldnames = [
        "instance_id", "vanilla_status", "omg_status", "change",
        "vanilla_tokens", "omg_tokens", "vanilla_time", "omg_time"
    ]

    with open(output_file, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for inst_id, inst_data in sorted(comparison["per_instance"].items()):
            writer.writerow({
                "instance_id": inst_id,
                "vanilla_status": inst_data["vanilla_status"],
                "omg_status": inst_data["omg_status"],
                "change": inst_data["change"],
                "vanilla_tokens": inst_data["vanilla_tokens"],
                "omg_tokens": inst_data["omg_tokens"],
                "vanilla_time": inst_data["vanilla_time"],
                "omg_time": inst_data["omg_time"],
            })

    logger.info(f"CSV saved to {output_file}")


def main():
    parser = argparse.ArgumentParser(
        description="Compare SWE-bench results between vanilla and OMG runs",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Basic comparison
    python compare_results.py --vanilla results/vanilla/ --omg results/omg/

    # With custom output directory
    python compare_results.py --vanilla results/vanilla/ --omg results/omg/ \\
        --output comparison/

    # Generate all formats
    python compare_results.py --vanilla results/vanilla/ --omg results/omg/ \\
        --output comparison/ --all-formats
        """
    )

    parser.add_argument(
        "--vanilla",
        type=Path,
        required=True,
        help="Path to vanilla Gemini Code results directory"
    )

    parser.add_argument(
        "--omg",
        type=Path,
        required=True,
        help="Path to OMG-enhanced results directory"
    )

    parser.add_argument(
        "--output", "-o",
        type=Path,
        default=Path("comparison"),
        help="Output directory for comparison reports (default: comparison/)"
    )

    parser.add_argument(
        "--all-formats",
        action="store_true",
        help="Generate all output formats (JSON, Markdown, CSV)"
    )

    parser.add_argument(
        "--json-only",
        action="store_true",
        help="Only generate JSON output"
    )

    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose logging"
    )

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Validate inputs
    if not args.vanilla.exists():
        logger.error(f"Vanilla results directory not found: {args.vanilla}")
        return 1

    if not args.omg.exists():
        logger.error(f"OMG results directory not found: {args.omg}")
        return 1

    # Create output directory
    args.output.mkdir(parents=True, exist_ok=True)

    # Load results
    logger.info(f"Loading vanilla results from {args.vanilla}")
    vanilla_results = load_results(args.vanilla)

    logger.info(f"Loading OMG results from {args.omg}")
    omg_results = load_results(args.omg)

    # Compare
    logger.info("Comparing results...")
    comparison = compare_results(vanilla_results, omg_results)

    # Generate outputs
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # Always generate JSON
    json_file = args.output / f"comparison_{timestamp}.json"
    with open(json_file, "w") as f:
        json.dump(comparison, f, indent=2)
    logger.info(f"JSON saved to {json_file}")

    if not args.json_only:
        # Generate Markdown
        md_file = args.output / f"comparison_{timestamp}.md"
        md_report = generate_markdown_report(comparison)
        md_file.write_text(md_report)
        logger.info(f"Markdown saved to {md_file}")

        if args.all_formats:
            # Generate CSV
            csv_file = args.output / f"comparison_{timestamp}.csv"
            generate_csv(comparison, csv_file)

    # Print summary
    delta = comparison["overall"]["delta"]
    print("\n" + "=" * 60)
    print("COMPARISON COMPLETE")
    print("=" * 60)
    print(f"Vanilla Pass Rate: {comparison['overall']['vanilla']['pass_rate']:.2f}%")
    print(f"OMG Pass Rate:     {comparison['overall']['omg']['pass_rate']:.2f}%")
    print(f"Delta:             {delta['pass_rate']:+.2f} percentage points")
    print(f"\nImprovements:      {comparison['improvements']['count']}")
    print(f"Regressions:       {comparison['regressions']['count']}")
    print(f"\nResults saved to:  {args.output}")
    print("=" * 60)

    return 0


if __name__ == "__main__":
    exit(main())
