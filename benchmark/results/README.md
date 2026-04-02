# SWE-bench Verified Results

## Summary

| Mode | Pass Rate | Avg Tokens | Avg Time | Total Cost |
|------|-----------|------------|----------|------------|
| Vanilla | -% | - | -m | $- |
| OMG | -% | - | -m | $- |

**Delta:** - percentage points improvement

## Methodology

### Dataset

- **Benchmark:** SWE-bench Verified (500 instances)
- **Source:** princeton-nlp/SWE-bench_Verified
- **Selection:** Curated subset of real GitHub issues with verified solutions

### Evaluation Setup

- **Model:** Gemini Sonnet 4.6 (gemini-sonnet-4-6-20260217)
- **Max Tokens:** 16,384 output tokens per instance
- **Timeout:** 30 minutes per instance
- **Workers:** 4 parallel evaluations
- **Hardware:** [Specify machine type]

### Vanilla Configuration

Standard Gemini Code with default settings:
- No OMG extensions loaded
- Default system prompt
- Single-agent execution

### OMG Configuration

Oh-My-GeminiCode enhanced with:
- Multi-agent orchestration
- Specialist delegation (architect, executor, etc.)
- Ralph persistence loop for complex tasks
- Ultrawork parallel execution
- Automatic skill invocation

### Metrics Collected

1. **Pass Rate:** Percentage of instances where generated patch passes all tests
2. **Token Usage:** Input + output tokens consumed per instance
3. **Time:** Wall-clock time from start to patch generation
4. **Cost:** Estimated API cost based on token usage

## Results Breakdown

### By Repository

| Repository | Vanilla | OMG | Delta |
|------------|---------|-----|-------|
| django | -/- | -/- | - |
| flask | -/- | -/- | - |
| requests | -/- | -/- | - |
| ... | ... | ... | ... |

### By Difficulty

| Difficulty | Vanilla | OMG | Delta |
|------------|---------|-----|-------|
| Easy | -% | -% | - |
| Medium | -% | -% | - |
| Hard | -% | -% | - |

### Failure Analysis

Top failure categories for each mode:

**Vanilla:**
1. Category: N failures (N%)
2. ...

**OMG:**
1. Category: N failures (N%)
2. ...

## Improvements

Instances that OMG solved but vanilla failed:

| Instance ID | Category | Notes |
|-------------|----------|-------|
| ... | ... | ... |

## Regressions

Instances that vanilla solved but OMG failed:

| Instance ID | Category | Notes |
|-------------|----------|-------|
| ... | ... | ... |

## Reproduction

### Prerequisites

```bash
# Install SWE-bench
pip install swebench

# Install oh-my-gemini (if testing OMG)
# Follow setup instructions in main README
```

### Running Vanilla Baseline

```bash
# Generate predictions
python run_benchmark.py --mode vanilla --dataset swe-bench-verified --output results/vanilla/

# Evaluate
python evaluate.py --predictions results/vanilla/predictions.json --output results/vanilla/
```

### Running OMG

```bash
# Generate predictions with OMG
python run_benchmark.py --mode omg --dataset swe-bench-verified --output results/omg/

# Evaluate
python evaluate.py --predictions results/omg/predictions.json --output results/omg/
```

### Comparing Results

```bash
python compare_results.py --vanilla results/vanilla/ --omg results/omg/ --output comparison/
```

### Analyzing Failures

```bash
python analyze_failures.py --vanilla results/vanilla/ --omg results/omg/ --compare --output analysis/
```

## Files

```
results/
├── vanilla/
│   ├── predictions.json      # Generated patches
│   ├── summary.json          # Evaluation summary
│   ├── report.md             # Human-readable report
│   └── logs/                 # Per-instance logs
├── omg/
│   ├── predictions.json
│   ├── summary.json
│   ├── report.md
│   └── logs/
├── comparison/
│   ├── comparison_*.json     # Detailed comparison data
│   ├── comparison_*.md       # Comparison report
│   └── comparison_*.csv      # Per-instance CSV
└── analysis/
    ├── failure_analysis_*.json
    └── failure_analysis_*.md
```

## Notes

- Results may vary based on API model version and temperature
- Some instances may have non-deterministic test outcomes
- Cost estimates are approximate based on published pricing

## References

- [SWE-bench Paper](https://arxiv.org/abs/2310.06770)
- [SWE-bench Repository](https://github.com/princeton-nlp/SWE-bench)
- [Oh-My-GeminiCode Documentation](../README.md)

---

*Last updated: [DATE]*
