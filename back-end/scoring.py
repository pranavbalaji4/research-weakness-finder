import re
from typing import Dict, List

# Simple, interpretable heuristics-based scorer for research reports.

def _scale(score: float) -> int:
	score = max(0.0, min(1.0, score))
	return int(round(score * 100))

def _count_keywords(text: str, keywords: List[str]) -> int:
	t = text.lower()
	return sum(1 for kw in keywords if kw in t)

def _keyword_density(text: str, keywords: List[str]) -> float:
	if not keywords:
		return 0.0
	return _count_keywords(text, keywords) / len(keywords)

def _approx_reference_count(text: str) -> int:
	refs = 0
	refs += len(re.findall(r'\[[0-9]{1,3}\]', text))
	refs += len(re.findall(r'\([A-Z][a-z]+,\s?\d{4}\)', text))
	m = re.split(r'\n\s*references\s*\n', text, flags=re.I)
	if len(m) > 1:
		ref_section = m[1]
		lines = [l.strip() for l in ref_section.splitlines() if l.strip()]
		refs += len(lines)
	return refs

def _extract_citations(text: str) -> list:
	"""Return a short list of detected citation strings or reference lines."""
	citations = []
	# try to capture parenthetical citations like (Smith, 2020)
	for m in re.findall(r"\([A-Z][A-Za-z\-\.\s]+,\s?\d{4}\)", text):
		if m not in citations:
			citations.append(m)
	# capture bracketed numeric citations and try to pull nearby context from References
	refs_sec = re.split(r'\n\s*references\s*\n', text, flags=re.I)
	if len(refs_sec) > 1:
		ref_lines = [l.strip() for l in refs_sec[1].splitlines() if l.strip()]
		for line in ref_lines[:10]:
			if len(citations) >= 10:
				break
			if line not in citations:
				citations.append(line)
	# fallback: if still empty, look for bracket citations like [1]
	if not citations:
		for m in re.findall(r"\[[0-9]{1,3}\]", text):
			if m not in citations:
				citations.append(m)
	return citations

def _has_out_of_sample(text: str) -> bool:
	return bool(re.search(r'out[- ]of[- ]sample|holdout|validation sample', text, flags=re.I))

def _has_backtest(text: str) -> bool:
	return bool(re.search(r'backtest|back-tested|back testing|back-testing', text, flags=re.I))

def _has_transaction_costs(text: str) -> bool:
	return bool(re.search(r'transaction cost|slippage|fee|commission', text, flags=re.I))

def _has_stat_tests(text: str) -> bool:
	return bool(re.search(r'\bp-?value\b|p <|t[- ]test|confidence interval|standard error|std err', text, flags=re.I))

def _has_robustness_checks(text: str) -> bool:
	return bool(re.search(r'robustness|sensitivity|alternative specification|placebo|jackknife|bootstrap', text, flags=re.I))

def _has_data_description(text: str) -> bool:
	return bool(re.search(r'sample size|n =|sample period|from .* to .*|data source|dataset|panel data|cross[- ]section', text, flags=re.I))

def compute_scores(text: str) -> Dict[str, object]:
	"""
	Returns a dict with 0-100 integer scores and short breakdown findings.
	Keys: methodology, originality, literature, robustness, breakdown
	"""
	t = text if isinstance(text, str) else ""

	# Methodology
	data_desc = _has_data_description(t)
	stat_tests = _has_stat_tests(t)
	backtest = _has_backtest(t)
	out_of_sample = _has_out_of_sample(t)
	identification_keywords = ['control', 'controls', 'instrumental variable', 'instrument', 'difference-in-differences', 'did', 'regress', 'regression', 'fixed effects', 'random effects', 'endogeneity', 'causal']
	id_strength = _keyword_density(t, identification_keywords)

	method_score_raw = (
		(0.20 * (1.0 if data_desc else 0.0)) +
		(0.20 * (1.0 if stat_tests else 0.0)) +
		(0.20 * (1.0 if backtest else 0.0)) +
		(0.20 * (1.0 if out_of_sample else 0.0)) +
		(0.20 * id_strength)
	)
	method_score = _scale(method_score_raw)

	# Originality
	novelty_keywords = ['novel', 'first', 'new dataset', 'unique dataset', 'previously unreported', 'contribution', 'we show for the first time', 'novel approach', 'new approach']
	novelty_density = _keyword_density(t, novelty_keywords)
	originality_raw = 0.6 * novelty_density + 0.4 * (method_score_raw)
	originality_score = _scale(originality_raw)

	# Literature
	ref_count = _approx_reference_count(t)
	if ref_count == 0:
		literature_raw = 0.1
	elif ref_count < 5:
		literature_raw = 0.35
	elif ref_count < 15:
		literature_raw = 0.65
	else:
		literature_raw = 0.9
	engagement_kws = ['related work', 'literature', 'we build on', 'extends', 'contradict', 'contrast', 'consistent with']
	literature_raw = min(1.0, literature_raw + 0.15 * _keyword_density(t, engagement_kws))
	literature_score = _scale(literature_raw)

	# Robustness
	robustness_checks = _has_robustness_checks(t)
	transaction_costs = _has_transaction_costs(t)
	code_availability = bool(re.search(r'github.com|code available|replication package|supplementary materials|appendix', t, flags=re.I))
	capacity_kws = ['capacity', 'scalability', 'slippage', 'market impact', 'liquidity']
	capacity_mention = _keyword_density(t, capacity_kws)

	robustness_raw = (
		0.35 * (1.0 if robustness_checks else 0.0) +
		0.25 * (1.0 if transaction_costs else 0.0) +
		0.20 * (1.0 if code_availability else 0.0) +
		0.20 * capacity_mention
	)
	robustness_score = _scale(robustness_raw)

	# Findings
	findings_method: List[str] = []
	if data_desc:
		findings_method.append("Data description present (sample, period, or source).")
	else:
		findings_method.append("Missing clear data/sample description.")
	if stat_tests:
		findings_method.append("Statistical tests or p-values reported.")
	else:
		findings_method.append("No explicit statistical test reporting found.")
	if backtest or out_of_sample:
		findings_method.append("Backtesting / out-of-sample evaluation included.")
	else:
		findings_method.append("No backtest or out-of-sample validation detected.")
	if id_strength > 0.0:
		findings_method.append("Identification/controls language present.")
	else:
		findings_method.append("Weak or no identification strategy language detected.")

	findings_originality: List[str] = []
	if novelty_density > 0:
		findings_originality.append("Claims of novelty or unique data/method present.")
	else:
		findings_originality.append("No clear claims of novelty or unique data/method found.")
	findings_originality.append("Originality score blended with methodology strength to reduce false positives.")

	findings_literature: List[str] = []
	findings_literature.append(f"Estimated reference citations: {ref_count}.")
	if _keyword_density(t, engagement_kws) > 0:
		findings_literature.append("Engages with related work / contrasts conclusions.")
	else:
		findings_literature.append("Limited explicit engagement with prior literature detected.")

	findings_robustness: List[str] = []
	if robustness_checks:
		findings_robustness.append("Robustness / sensitivity checks mentioned.")
	else:
		findings_robustness.append("No robustness/sensitivity checks detected.")
	if transaction_costs:
		findings_robustness.append("Transaction costs / market frictions discussed.")
	else:
		findings_robustness.append("No transaction cost or market impact discussion found.")
	if code_availability:
		findings_robustness.append("Code or replication material appears available.")
	else:
		findings_robustness.append("No explicit replication package or code link detected.")

	breakdown = {
		"methodology": findings_method,
		"originality": findings_originality,
		"literature": findings_literature,
		"robustness": findings_robustness
	}

	return {
		"methodology": method_score,
		"originality": originality_score,
		"literature": literature_score,
		"robustness": robustness_score,
		"breakdown": breakdown,
		"citations": _extract_citations(t)
	}

