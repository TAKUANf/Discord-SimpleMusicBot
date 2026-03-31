import { getLogger } from "../../../logger";

const logger = getLogger("StrategyHealthMonitor");

interface StrategyMetrics {
  successes: number;
  failures: number;
  totalLatencyMs: number;
  recentResults: boolean[]; // true = success, last N results
}

const MAX_RECENT_RESULTS = 20;
const AUTO_DISABLE_FAILURE_RATE = 0.8;
const RECOVERY_CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export class StrategyHealthMonitor {
  private metrics: Map<number, StrategyMetrics> = new Map();
  private disabledStrategies: Set<number> = new Set();
  private lastRecoveryCheck: number = Date.now();

  private getOrCreateMetrics(strategyIndex: number): StrategyMetrics {
    let m = this.metrics.get(strategyIndex);
    if (!m) {
      m = { successes: 0, failures: 0, totalLatencyMs: 0, recentResults: [] };
      this.metrics.set(strategyIndex, m);
    }
    return m;
  }

  recordSuccess(strategyIndex: number, latencyMs: number): void {
    const m = this.getOrCreateMetrics(strategyIndex);
    m.successes++;
    m.totalLatencyMs += latencyMs;
    m.recentResults.push(true);
    if (m.recentResults.length > MAX_RECENT_RESULTS) {
      m.recentResults.shift();
    }

    // Re-enable if previously disabled and now succeeding
    if (this.disabledStrategies.has(strategyIndex)) {
      this.disabledStrategies.delete(strategyIndex);
      logger.info(`Strategy #${strategyIndex} re-enabled after successful attempt`);
    }
  }

  recordFailure(strategyIndex: number): void {
    const m = this.getOrCreateMetrics(strategyIndex);
    m.failures++;
    m.recentResults.push(false);
    if (m.recentResults.length > MAX_RECENT_RESULTS) {
      m.recentResults.shift();
    }

    // Auto-disable if recent failure rate exceeds threshold
    this.checkAutoDisable(strategyIndex);
  }

  private checkAutoDisable(strategyIndex: number): void {
    const m = this.metrics.get(strategyIndex);
    if (!m || m.recentResults.length < 5) return; // Need at least 5 samples

    const recentFailures = m.recentResults.filter(r => !r).length;
    const failureRate = recentFailures / m.recentResults.length;

    if (failureRate >= AUTO_DISABLE_FAILURE_RATE) {
      this.disabledStrategies.add(strategyIndex);
      logger.warn(`Strategy #${strategyIndex} auto-disabled (failure rate: ${(failureRate * 100).toFixed(0)}%)`);
    }
  }

  isDisabled(strategyIndex: number): boolean {
    // Periodically allow recovery attempts
    if (this.disabledStrategies.size > 0 && Date.now() - this.lastRecoveryCheck >= RECOVERY_CHECK_INTERVAL_MS) {
      this.lastRecoveryCheck = Date.now();
      this.disabledStrategies.clear();
      logger.info("Recovery check: all auto-disabled strategies re-enabled for retry");
    }
    return this.disabledStrategies.has(strategyIndex);
  }

  /**
   * Returns strategy indices sorted by health score (higher is better).
   * Strategies with higher success rate and lower latency are preferred.
   */
  getOrderedStrategies(enabledIndices: number[]): number[] {
    return [...enabledIndices].sort((a, b) => {
      const ma = this.metrics.get(a);
      const mb = this.metrics.get(b);

      // Strategies with no data go in their original order
      if (!ma && !mb) return 0;
      if (!ma) return 1;
      if (!mb) return -1;

      const successRateA = ma.successes / (ma.successes + ma.failures) || 0;
      const successRateB = mb.successes / (mb.successes + mb.failures) || 0;

      // Primary: success rate (higher is better)
      if (Math.abs(successRateA - successRateB) > 0.1) {
        return successRateB - successRateA;
      }

      // Secondary: average latency (lower is better)
      const avgLatencyA = ma.successes > 0 ? ma.totalLatencyMs / ma.successes : Infinity;
      const avgLatencyB = mb.successes > 0 ? mb.totalLatencyMs / mb.successes : Infinity;
      return avgLatencyA - avgLatencyB;
    });
  }
}

export const strategyHealthMonitor = new StrategyHealthMonitor();
