# Project Overview: Daatan

**Daatan** is a data-driven reputation ledger and forecasting engine designed to bring objective measurement to public predictions. By operating at the intersection of AI data science, media analysis, and prediction markets, Daatan audits the historical accuracy of experts, journalists, and media outlets to uncover actionable quantitative alpha.

### The Core Problem: The Signal-to-Noise Ratio
Every day, a massive volume of predictions regarding geopolitical shifts, macroeconomic trends, and market movements is published across global media. The challenge is that the information ecosystem lacks a standardized mechanism to track the long-term accuracy of these forecasts. Consequently, market sentiment and decisions are frequently influenced by the reach and volume of a publication rather than its proven track record. Until now, there has been no scalable, objective method to separate reliable foresight from general commentary.

### The Catalyst: Bypassing the "Cold Start" Problem
Retro Analysis (בדיעבד) was originally born to solve a core challenge within Daatan Forecast—our active predictive modeling platform that sits alongside Daatan PulseNews for real-time monitoring. 

Normally, for an expert or analyst to be ranked by a forecasting system, they must actively participate and log predictions over months or years to build a reputation score. Retro Analysis bypasses this limitation entirely. Instead of waiting for pundits to opt-in and make new predictions, we retroactively audit the massive public trail of forecasts they have *already* published. 

We process this through a "100x100 Matrix" that plots major historical events against global media and analysts. Using proprietary LLM pipelines, Daatan extracts a forecaster's *Stance* and *Certainty*, compares it against verifiable ground truth, and assigns precise accuracy metrics (like Brier and Elo scores). The result is an immediate, objective leaderboard of predictive accuracy.

### The Engine: Unlocking the Future Through the Past 
Ranking the past is only the first step. By fully analyzing historical data, we unlock something much more powerful than a simple reputation ledger. 

In Retro Analysis, the verifiable "ground truth" we use to grade a past prediction is essentially the *future* relative to that publication. By mapping this at scale, we generate a massive dataset of direct correlations between specific publications, expert sentiment, and actual outcomes. The 100x100 Matrix becomes a proprietary, high-signal training dataset for our core predictive engine: **The TruthMachine**.

Because we mathematically understand how past language correlates with actual ground truth, The TruthMachine can analyze today's news and output precise probability scores for tomorrow's events. This shifts Daatan from a media-auditing tool into a predictive engine that provides quantifiable certainty. The primary use cases include:
* **Quantitative Funds & Traders:** Providing API/DaaS access for untainted, high-signal alternative data.
* **Prediction Markets:** Offering data-driven tooling to participants (such as volume traders on Polymarket) to gain a distinct edge over retail consensus.
* **Enterprise Risk:** Equipping corporate officers with dashboards to navigate geopolitical and supply chain volatility.

### The Vision
Daatan's ultimate goal is to democratize alpha and create a definitive reliability layer for the internet. By objectively measuring predictive accuracy, we can filter out the noise, reward high-signal analysis, and provide the most reliable probabilities for tomorrow's most critical events.

---

## Slide / Appendix A: The LLM & NLP Pipeline
**Headline: Task-Specific Routing for Maximum Margin**

**Hybrid LLM Architecture:** We do not burn capital running every query through expensive, top-tier commercial APIs. We use a dynamic routing system, leveraging self-hosted, highly optimized local models for high-volume tasks, and only calling heavy commercial models for complex nuance resolution.

**Multilingual Alpha Extraction:** The English-speaking market is saturated. Our pipeline natively ingests and analyzes non-English media, capturing geopolitical and financial signals long before they hit US mainstream media.

**The Extraction Engine:** We process articles with a specially developed but straightforward mathematical mechanism. For every article that qualifies as a prediction, the engine explicitly extracts a multidimensional vector of specific numerical values. This includes core metrics like Stance (the directional prediction), Sentiment (the underlying emotional or market tone), and Certainty (the degree of sureness), among other proprietary data points. These measurable metrics allow us to convert qualitative journalism into quantitative data.

## Slide / Appendix B: The Mathematics of Truth
**Headline: Eliminating Subjectivity through Strict Scoring**

Our TruthMachine converts those extracted metrics into quantitative vectors using two proven mathematical models.

**The Brier Score (Probabilistic Accuracy):** To measure how close a source's extracted prediction was to the absolute truth, we calculate their Brier Score. The formula strictly measures their forecasted probability (derived from their stance and certainty) against the actual binary outcome of the event.

**The Elo Rating System (Relative Reputation):** We rank sources dynamically using a modified Elo algorithm. If an unknown blogger correctly predicts a rare event that a legacy newspaper gets wrong, the blogger absorbs a massive Elo rating increase, instantly surfacing hidden alpha.

## Slide / Appendix C: Lean Infrastructure Stack
**Headline: Enterprise-Grade Data Velocity at Startup Costs**

**Self-Hosted Cloud Compute:** The backend is built on dedicated AWS EC2 instances, leveraging our AWS Activate tier to keep initial burn rates near zero.

**Orchestration:** We currently orchestrate our local LLMs via OpenClaw and custom wrappers.

**Scalability:** The architecture is designed to be lean. As the matrix expands from 100x100 to 200x200 and deeper, we have a clear, cost-effective path to horizontally scale up to multiple EC2 instances. This keeps our burn rate incredibly low while maintaining the data velocity we need to beat the market.
