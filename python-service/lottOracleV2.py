import numpy as np
import pandas as pd
from typing import List, Dict, Tuple
from collections import Counter, deque
import random
import hashlib
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
import warnings

warnings.filterwarnings('ignore')


# ============================================================================
# ENHANCED LOTTO ORACLE 2.0 - "PATTERN PROBE"
# ============================================================================

class AdvancedPatternDetector:
    """
    Advanced statistical anomaly and pattern detector
    Uses multiple time-series analysis techniques
    """

    def __init__(self, window_sizes=None):
        if window_sizes is None:
            window_sizes = [20, 50, 100]
        self.window_sizes = window_sizes
        self.pattern_memory = deque(maxlen=1000)

    def detect_regime_change(self, recent_draws: List[List[int]]) -> Dict:
        """Detect if statistical properties have changed significantly"""
        if len(recent_draws) < 100:
            return {"detected": False, "confidence": 0}

        # Split into two halves
        half = len(recent_draws) // 2
        old = recent_draws[:half]
        new = recent_draws[half:]

        # Calculate multiple metrics for both periods
        metrics_old = self._calculate_period_metrics(old)
        metrics_new = self._calculate_period_metrics(new)

        # Calculate change scores
        changes = {}
        for key in metrics_old:
            if isinstance(metrics_old[key], (int, float)):
                change = abs(metrics_new[key] - metrics_old[key]) / (abs(metrics_old[key]) + 1e-10)
                changes[key] = change

        # Weighted change score
        weights = {'sum_mean': 0.3, 'delta_entropy': 0.4, 'cluster_score': 0.3}
        total_change = sum(changes.get(k, 0) * weights.get(k, 0) for k in weights)

        return {
            "detected": total_change > 0.25,
            "confidence": min(total_change, 1),
            "details": {k: f"{v:.2%}" for k, v in changes.items() if v > 0.1}
        }

    def _calculate_period_metrics(self, draws: List[List[int]]) -> Dict:
        """Calculate comprehensive statistical metrics for a period"""
        if not draws:
            return {}

        all_numbers = [num for draw in draws for num in draw]
        sums = [sum(draw) for draw in draws]

        # Calculate delta entropy (measure of randomness in gaps)
        deltas = []
        for draw in draws:
            if not draw or len(draw) < 2:
                continue
            sorted_draw = sorted(draw)
            if len(sorted_draw) >= 2:
                deltas.extend([sorted_draw[i] - sorted_draw[i - 1] for i in range(1, len(sorted_draw))])

        delta_counts = Counter(deltas)
        total = sum(delta_counts.values())
        entropy = -sum((count / total) * np.log2(count / total) for count in delta_counts.values())

        # Cluster detection
        clusters = self._detect_number_clusters(draws)

        return {
            "sum_mean": np.mean(sums),
            "sum_std": np.std(sums),
            "number_entropy": -sum((all_numbers.count(x) / len(all_numbers)) *
                                   np.log2(all_numbers.count(x) / len(all_numbers))
                                   for x in set(all_numbers)),
            "delta_entropy": entropy,
            "cluster_score": len(clusters) / len(draws) if draws else 0
        }

    def _detect_number_clusters(self, draws: List[List[int]]) -> List[List[int]]:
        """Detect if numbers in a draw are clustered together"""
        clusters = []
        for draw in draws:
            if not draw or len(draw) < 2:
                continue
            sorted_draw = sorted(draw)
            if len(sorted_draw) >= 2:
                gaps = [sorted_draw[i] - sorted_draw[i - 1] for i in range(1, len(sorted_draw))]
                if gaps and max(gaps) < 25:  # Numbers are within 25 of each other
                    clusters.append(draw)
        return clusters


class ZoneAnalyzer:
    """
    Analyzes number zones (1-10, 11-20, etc.) for prediction enhancement
    """
    ZONES = [(1, 10), (11, 20), (21, 30), (31, 40), (41, 50), 
             (51, 60), (61, 70), (71, 80), (81, 90)]
    
    def __init__(self):
        self.zone_history = []
    
    def get_zone(self, num: int) -> int:
        """Get zone index (0-8) for a number"""
        return (num - 1) // 10
    
    def analyze_zone_patterns(self, draws: List[List[int]]) -> Dict:
        """Analyze zone distribution patterns"""
        if not draws:
            return {}
        
        # Count zone appearances
        zone_counts = Counter()
        zone_recent = Counter()  # Last 20 draws
        recent_draws = draws[-20:] if len(draws) >= 20 else draws
        
        for draw in draws:
            zones_in_draw = [self.get_zone(n) for n in draw]
            for z in zones_in_draw:
                zone_counts[z] += 1
        
        for draw in recent_draws:
            zones_in_draw = [self.get_zone(n) for n in draw]
            for z in zones_in_draw:
                zone_recent[z] += 1
        
        # Calculate zone due scores (zones that haven't appeared recently)
        total_draws = len(draws)
        expected_per_zone = (total_draws * 5) / 9  # 5 numbers, 9 zones
        
        zone_due_scores = {}
        for z in range(9):
            actual = zone_counts.get(z, 0)
            recent = zone_recent.get(z, 0)
            # Due score: higher if zone is underrepresented recently
            due_score = (expected_per_zone - recent) / (expected_per_zone + 1)
            zone_due_scores[z] = max(0, due_score)
        
        # Most common zone combinations
        zone_combos = Counter()
        for draw in draws[-50:]:
            zones = tuple(sorted(set(self.get_zone(n) for n in draw)))
            zone_combos[zones] += 1
        
        return {
            'zone_counts': dict(zone_counts),
            'zone_recent': dict(zone_recent),
            'zone_due_scores': zone_due_scores,
            'common_zone_combos': zone_combos.most_common(5),
            'hot_zones': [z for z, _ in sorted(zone_recent.items(), key=lambda x: x[1], reverse=True)[:3]],
            'cold_zones': [z for z, _ in sorted(zone_recent.items(), key=lambda x: x[1])[:3]]
        }
    
    def get_zone_recommendations(self, zone_analysis: Dict) -> List[int]:
        """Get recommended zones for next prediction"""
        if not zone_analysis:
            return list(range(9))
        
        # Balance hot and due zones
        hot = zone_analysis.get('hot_zones', [])[:2]
        due_scores = zone_analysis.get('zone_due_scores', {})
        due = sorted(due_scores.items(), key=lambda x: x[1], reverse=True)[:2]
        due_zones = [z for z, _ in due]
        
        # Combine: 2 hot + 2 due + 1 random for balance
        recommended = list(set(hot + due_zones))
        if len(recommended) < 5:
            remaining = [z for z in range(9) if z not in recommended]
            recommended.extend(remaining[:5 - len(recommended)])
        
        return recommended[:5]


class GapAnalyzer:
    """
    Analyzes gap patterns within draws for prediction enhancement
    """
    
    def analyze_gaps(self, draws: List[List[int]]) -> Dict:
        """Analyze gap patterns in draws"""
        if not draws:
            return {}
        
        all_gaps = []
        gap_sequences = []
        
        for draw in draws:
            sorted_draw = sorted(draw)
            if len(sorted_draw) >= 2:
                gaps = [sorted_draw[i] - sorted_draw[i-1] for i in range(1, len(sorted_draw))]
                all_gaps.extend(gaps)
                gap_sequences.append(tuple(gaps))
        
        gap_counter = Counter(all_gaps)
        sequence_counter = Counter(gap_sequences)
        
        # Most common individual gaps
        common_gaps = gap_counter.most_common(10)
        
        # Average and std of gaps
        avg_gap = np.mean(all_gaps) if all_gaps else 0
        std_gap = np.std(all_gaps) if all_gaps else 0
        
        # Common gap sequences (full 4-gap patterns)
        common_sequences = sequence_counter.most_common(5)
        
        return {
            'common_gaps': common_gaps,
            'avg_gap': avg_gap,
            'std_gap': std_gap,
            'min_gap': min(all_gaps) if all_gaps else 0,
            'max_gap': max(all_gaps) if all_gaps else 0,
            'common_sequences': common_sequences,
            'ideal_gap_range': (max(1, int(avg_gap - std_gap)), int(avg_gap + std_gap))
        }
    
    def validate_gaps(self, prediction: List[int], gap_analysis: Dict) -> float:
        """Score a prediction based on gap patterns (0-1)"""
        if len(prediction) != 5:
            return 0.0
        
        sorted_pred = sorted(prediction)
        gaps = [sorted_pred[i] - sorted_pred[i-1] for i in range(1, 5)]
        
        ideal_range = gap_analysis.get('ideal_gap_range', (5, 25))
        common_gaps = dict(gap_analysis.get('common_gaps', []))
        
        score = 0.0
        
        # Check if gaps are in ideal range
        gaps_in_range = sum(1 for g in gaps if ideal_range[0] <= g <= ideal_range[1])
        score += gaps_in_range * 0.15
        
        # Bonus for common gaps
        for gap in gaps:
            if gap in common_gaps:
                score += 0.1 * (common_gaps[gap] / max(common_gaps.values()))
        
        # Penalty for consecutive numbers (gap = 1)
        consecutive = sum(1 for g in gaps if g == 1)
        score -= consecutive * 0.1
        
        # Penalty for very large gaps
        large_gaps = sum(1 for g in gaps if g > 30)
        score -= large_gaps * 0.1
        
        return max(0, min(1, score))


class TrendAnalyzer:
    """
    Analyzes trend momentum for numbers
    """
    
    def calculate_momentum(self, draws: List[List[int]], num: int, 
                          windows: List[int] = None) -> Dict:
        """Calculate trend momentum for a number"""
        if windows is None:
            windows = [5, 10, 20]
        
        if len(draws) < max(windows):
            return {'momentum': 0, 'trend': 'neutral', 'acceleration': 0}
        
        frequencies = []
        for window in windows:
            recent = draws[-window:]
            freq = sum(1 for d in recent if num in d) / window
            frequencies.append(freq)
        
        # Momentum: difference between short-term and long-term frequency
        if len(frequencies) >= 2:
            momentum = frequencies[0] - frequencies[-1]  # Short vs Long
            # Acceleration: change in momentum
            if len(frequencies) >= 3:
                mid_momentum = frequencies[0] - frequencies[1]
                long_momentum = frequencies[1] - frequencies[2]
                acceleration = mid_momentum - long_momentum
            else:
                acceleration = 0
        else:
            momentum = 0
            acceleration = 0
        
        # Determine trend
        if momentum > 0.05:
            trend = 'rising'
        elif momentum < -0.05:
            trend = 'falling'
        else:
            trend = 'neutral'
        
        return {
            'momentum': momentum,
            'trend': trend,
            'acceleration': acceleration,
            'frequencies': frequencies
        }
    
    def get_trending_numbers(self, draws: List[List[int]], top_n: int = 15) -> Dict:
        """Get numbers with strongest trends"""
        momentums = {}
        for num in range(1, 91):
            analysis = self.calculate_momentum(draws, num)
            momentums[num] = analysis
        
        # Sort by momentum
        rising = sorted(
            [(n, m) for n, m in momentums.items() if m['trend'] == 'rising'],
            key=lambda x: x[1]['momentum'], reverse=True
        )[:top_n]
        
        falling = sorted(
            [(n, m) for n, m in momentums.items() if m['trend'] == 'falling'],
            key=lambda x: x[1]['momentum']
        )[:top_n]
        
        # Numbers with positive acceleration (trend strengthening)
        accelerating = sorted(
            [(n, m) for n, m in momentums.items() if m['acceleration'] > 0.02],
            key=lambda x: x[1]['acceleration'], reverse=True
        )[:top_n]
        
        return {
            'rising': [n for n, _ in rising],
            'falling': [n for n, _ in falling],
            'accelerating': [n for n, _ in accelerating],
            'all_momentums': momentums
        }


class AntiPatternFilter:
    """
    Filters out unlikely patterns that rarely win
    """
    
    # Common anti-patterns to avoid
    ANTI_PATTERNS = {
        'all_evens': lambda nums: all(n % 2 == 0 for n in nums),
        'all_odds': lambda nums: all(n % 2 == 1 for n in nums),
        'all_high': lambda nums: all(n > 45 for n in nums),
        'all_low': lambda nums: all(n <= 45 for n in nums),
        'all_same_decade': lambda nums: len(set((n-1)//10 for n in nums)) == 1,
        'consecutive_5': lambda nums: sorted(nums) == list(range(min(nums), min(nums)+5)),
        'sum_too_low': lambda nums: sum(nums) < 100,
        'sum_too_high': lambda nums: sum(nums) > 350,
        'all_multiples_5': lambda nums: all(n % 5 == 0 for n in nums),
        'all_multiples_10': lambda nums: all(n % 10 == 0 for n in nums),
    }
    
    def check_patterns(self, prediction: List[int]) -> Dict:
        """Check prediction against anti-patterns"""
        violations = {}
        for name, check in self.ANTI_PATTERNS.items():
            if check(prediction):
                violations[name] = True
        
        return {
            'is_valid': len(violations) == 0,
            'violations': violations,
            'score': 1.0 - (len(violations) * 0.15)  # Penalty per violation
        }
    
    def fix_prediction(self, prediction: List[int], 
                       number_pool: List[int] = None) -> List[int]:
        """Fix a prediction that violates anti-patterns"""
        if number_pool is None:
            number_pool = list(range(1, 91))
        
        result = prediction.copy()
        max_iterations = 10
        
        for _ in range(max_iterations):
            check = self.check_patterns(result)
            if check['is_valid']:
                break
            
            # Try to fix by replacing numbers
            violations = check['violations']
            
            if 'all_evens' in violations:
                # Replace one even with odd
                evens = [n for n in result if n % 2 == 0]
                if evens:
                    to_replace = evens[0]
                    candidates = [n for n in number_pool if n % 2 == 1 and n not in result]
                    if candidates:
                        result[result.index(to_replace)] = candidates[len(candidates)//2]
            
            elif 'all_odds' in violations:
                odds = [n for n in result if n % 2 == 1]
                if odds:
                    to_replace = odds[0]
                    candidates = [n for n in number_pool if n % 2 == 0 and n not in result]
                    if candidates:
                        result[result.index(to_replace)] = candidates[len(candidates)//2]
            
            elif 'all_high' in violations:
                highs = [n for n in result if n > 45]
                if highs:
                    to_replace = highs[0]
                    candidates = [n for n in number_pool if n <= 45 and n not in result]
                    if candidates:
                        result[result.index(to_replace)] = candidates[len(candidates)//2]
            
            elif 'all_low' in violations:
                lows = [n for n in result if n <= 45]
                if lows:
                    to_replace = lows[0]
                    candidates = [n for n in number_pool if n > 45 and n not in result]
                    if candidates:
                        result[result.index(to_replace)] = candidates[len(candidates)//2]
            
            elif 'sum_too_low' in violations:
                # Replace lowest number with higher
                result.sort()
                to_replace = result[0]
                candidates = [n for n in number_pool if n > 60 and n not in result]
                if candidates:
                    result[0] = candidates[0]
            
            elif 'sum_too_high' in violations:
                # Replace highest number with lower
                result.sort()
                to_replace = result[-1]
                candidates = [n for n in number_pool if n < 30 and n not in result]
                if candidates:
                    result[-1] = candidates[-1]
        
        return sorted(result)


class PositionAnalyzer:
    """
    Analyzes positional tendencies of numbers
    """
    
    def analyze_positions(self, draws: List[List[int]]) -> Dict:
        """Analyze which positions numbers tend to appear in"""
        # Position 0 = smallest, Position 4 = largest in sorted draw
        position_counts = {pos: Counter() for pos in range(5)}
        
        for draw in draws:
            sorted_draw = sorted(draw)
            for pos, num in enumerate(sorted_draw):
                position_counts[pos][num] += 1
        
        # For each position, get most common numbers
        position_favorites = {}
        for pos in range(5):
            top_nums = position_counts[pos].most_common(15)
            position_favorites[pos] = [n for n, _ in top_nums]
        
        # For each number, get preferred position
        number_positions = {}
        for num in range(1, 91):
            pos_counts = [(pos, position_counts[pos].get(num, 0)) for pos in range(5)]
            if sum(c for _, c in pos_counts) > 0:
                preferred_pos = max(pos_counts, key=lambda x: x[1])[0]
                number_positions[num] = preferred_pos
        
        return {
            'position_favorites': position_favorites,
            'number_positions': number_positions,
            'position_counts': {pos: dict(counts) for pos, counts in position_counts.items()}
        }
    
    def validate_positions(self, prediction: List[int], 
                          position_analysis: Dict) -> float:
        """Score prediction based on positional tendencies"""
        if not prediction or len(prediction) != 5:
            return 0.5
        
        sorted_pred = sorted(prediction)
        position_favorites = position_analysis.get('position_favorites', {})
        
        score = 0.0
        for pos, num in enumerate(sorted_pred):
            favorites = position_favorites.get(pos, [])
            if num in favorites[:5]:
                score += 0.15
            elif num in favorites[:10]:
                score += 0.1
            elif num in favorites:
                score += 0.05
        
        return min(1.0, score)


class ConfidenceScorer:
    """
    Provides confidence scores for predictions
    """
    
    def __init__(self):
        self.zone_analyzer = ZoneAnalyzer()
        self.gap_analyzer = GapAnalyzer()
        self.anti_pattern = AntiPatternFilter()
        self.position_analyzer = PositionAnalyzer()
    
    def calculate_confidence(self, prediction: List[int], 
                            draws: List[List[int]],
                            strategy_agreement: float = 0.5) -> Dict:
        """Calculate comprehensive confidence score"""
        if not prediction or len(prediction) != 5:
            return {'confidence': 0, 'level': 'invalid', 'factors': {}}
        
        factors = {}
        
        # 1. Zone distribution score
        zone_analysis = self.zone_analyzer.analyze_zone_patterns(draws)
        zones_in_pred = [self.zone_analyzer.get_zone(n) for n in prediction]
        zone_diversity = len(set(zones_in_pred)) / 5
        factors['zone_diversity'] = zone_diversity
        
        # 2. Gap pattern score
        gap_analysis = self.gap_analyzer.analyze_gaps(draws)
        gap_score = self.gap_analyzer.validate_gaps(prediction, gap_analysis)
        factors['gap_pattern'] = gap_score
        
        # 3. Anti-pattern check
        anti_check = self.anti_pattern.check_patterns(prediction)
        factors['pattern_validity'] = anti_check['score']
        
        # 4. Position analysis
        position_analysis = self.position_analyzer.analyze_positions(draws)
        position_score = self.position_analyzer.validate_positions(prediction, position_analysis)
        factors['position_alignment'] = position_score
        
        # 5. Strategy agreement (from consensus)
        factors['strategy_agreement'] = strategy_agreement
        
        # 6. Historical frequency
        freq_score = 0
        for num in prediction:
            appearances = sum(1 for d in draws[-50:] if num in d)
            freq_score += min(appearances / 10, 0.2)
        factors['historical_frequency'] = min(1.0, freq_score)
        
        # Calculate weighted confidence
        weights = {
            'zone_diversity': 0.15,
            'gap_pattern': 0.15,
            'pattern_validity': 0.20,
            'position_alignment': 0.15,
            'strategy_agreement': 0.25,
            'historical_frequency': 0.10
        }
        
        confidence = sum(factors[k] * weights[k] for k in weights)
        
        # Determine confidence level
        if confidence >= 0.75:
            level = 'high'
        elif confidence >= 0.55:
            level = 'medium'
        elif confidence >= 0.35:
            level = 'low'
        else:
            level = 'very_low'
        
        return {
            'confidence': round(confidence, 3),
            'level': level,
            'factors': factors,
            'recommendation': self._get_recommendation(level, factors)
        }
    
    def _get_recommendation(self, level: str, factors: Dict) -> str:
        """Get recommendation based on confidence analysis"""
        if level == 'high':
            return "Strong prediction - multiple factors align well"
        elif level == 'medium':
            weak_factors = [k for k, v in factors.items() if v < 0.5]
            if weak_factors:
                return f"Moderate confidence - consider improving: {', '.join(weak_factors[:2])}"
            return "Moderate confidence - balanced prediction"
        elif level == 'low':
            return "Low confidence - prediction may need adjustment"
        else:
            return "Very low confidence - consider using a different strategy"


class MLPredictor:
    """
    Machine Learning component for number prediction
    Uses multiple models in ensemble
    """

    def __init__(self):
        self.models = {
            'rf': RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42),
            'gb': GradientBoostingClassifier(n_estimators=50, max_depth=3, random_state=42)
        }
        self.scaler = StandardScaler()
        self.is_trained = False
        self._smote_available = self._check_smote_availability()
    
    def _check_smote_availability(self) -> bool:
        """Check if SMOTE can be imported and used"""
        try:
            # Try importing imblearn first - this might fail if sklearn is incompatible
            import imblearn
        except Exception:
            return False
        
        try:
            # Try importing SMOTE specifically - this is where the sklearn error occurs
            from imblearn.over_sampling import SMOTE
        except (ImportError, AttributeError, Exception) as e:
            # Catch the specific _is_pandas_df error or any other import error
            import warnings
            warnings.warn(f"SMOTE import failed: {e}. Will use simple oversampling instead.")
            return False
        
        try:
            # Try creating an instance to catch any runtime errors
            _ = SMOTE(random_state=42)
            return True
        except Exception:
            return False

    def create_features(self, historical_draws: List[List[int]], lookback: int = 50) -> Tuple[np.ndarray, np.ndarray]:
        """Create features for ML prediction"""
        n_draws = len(historical_draws)
        if n_draws < lookback + 10:
            return np.array([]), np.array([])

        X, y = [], []

        for i in range(lookback, n_draws - 1):
            # Features based on recent history - with bounds checking
            if i + 1 >= n_draws:
                continue  # Skip if next_draw index is out of bounds
            recent = historical_draws[i - lookback:i] if i - lookback >= 0 else historical_draws[:i]
            next_draw = historical_draws[i + 1]

            for num in range(1, 91):
                # Feature vector for this number
                features = [
                    # Recent frequency
                    sum(1 for draw in recent if num in draw) / lookback,
                    # Skips (how many draws since last appearance)
                    self._calculate_skips(num, historical_draws[:i + 1]),
                    # Position tendency
                    self._position_tendency(num, recent),
                    # Delta relationships
                    self._delta_compatibility(num, recent),
                    # Even/Odd context
                    num % 2,
                    # High/Low
                    1 if num > 45 else 0,
                    # Recent trend (appearing more or less frequently)
                    self._trend_score(num, recent[-10:] if len(recent) >= 10 else recent)
                ]

                X.append(features)
                y.append(1 if num in next_draw else 0)

        return np.array(X), np.array(y)

    def train(self, historical_draws: List[List[int]]):
        """Train ML models"""
        X, y = self.create_features(historical_draws)

        if len(X) == 0:
            return False

        # Balance classes (since positives are rare)
        if self._smote_available:
            try:
                from imblearn.over_sampling import SMOTE
                smote = SMOTE(random_state=42)
                X_balanced, y_balanced = smote.fit_resample(X, y)
            except Exception as e:
                # If SMOTE fails at runtime, fall back to simple resampling
                import warnings
                warnings.warn(f"SMOTE failed at runtime ({e}), using random oversampling")
                X_balanced, y_balanced = self._simple_oversample(X, y)
        else:
            # Use simple random oversampling as fallback
            X_balanced, y_balanced = self._simple_oversample(X, y)

        # Scale features
        X_scaled = self.scaler.fit_transform(X_balanced)

        # Train each model
        for name, model in self.models.items():
            model.fit(X_scaled, y_balanced)

        self.is_trained = True
        return self.is_trained


    def _simple_oversample(self, X, y):
        """Simple random oversampling fallback when SMOTE is not available"""
        from sklearn.utils import resample
        
        # Separate positive and negative samples
        X_pos = [X[i] for i in range(len(X)) if y[i] == 1]
        y_pos = [1] * len(X_pos)
        X_neg = [X[i] for i in range(len(X)) if y[i] == 0]
        y_neg = [0] * len(X_neg)
        
        # Oversample positive class to match negative class
        if 0 < len(X_pos) < len(X_neg):
            X_pos_resampled, y_pos_resampled = resample(
                X_pos, y_pos, 
                n_samples=len(X_neg), 
                random_state=42
            )
            X_balanced = np.array(X_pos_resampled + X_neg)
            y_balanced = np.array(y_pos_resampled + y_neg)

        else:
            X_balanced, y_balanced = X, y

        return X_balanced, y_balanced

    def predict_proba(self, historical_draws: List[List[int]]) -> Dict[int, float]:
        """Predict probability for each number appearing in next draw"""
        if not self.is_trained:
            return {i: 1 / 90 for i in range(1, 91)}

        # Create features for current state
        recent = historical_draws[-50:] if len(historical_draws) >= 50 else historical_draws
        predictions = {}

        for num in range(1, 91):
            features = [
                sum(1 for draw in recent if num in draw) / len(recent),
                self._calculate_skips(num, historical_draws),
                self._position_tendency(num, recent),
                self._delta_compatibility(num, recent),
                num % 2,
                1 if num > 45 else 0,
                self._trend_score(num, recent[-10:] if len(recent) >= 10 else recent)
            ]

            features_scaled = self.scaler.transform([features])

            # Ensemble prediction (average of all models)
            probs = []
            for model in self.models.values():
                prob = model.predict_proba(features_scaled)[0][1]
                probs.append(prob)

            predictions[num] = np.mean(probs)

        # Normalize to sum to 1 (probability distribution)
        total = sum(predictions.values())
        if total > 0:
            predictions = {k: v / total for k, v in predictions.items()}

        return predictions

    def _calculate_skips(self, num: int, draws: List[List[int]]) -> int:
        """Calculate how many draws since number last appeared"""
        for i in range(len(draws) - 1, -1, -1):
            if num in draws[i]:
                return len(draws) - i - 1
        return len(draws)

    def _position_tendency(self, num: int, draws: List[List[int]]) -> float:
        """Calculate tendency to appear in specific position"""
        if not draws:
            return 0.5

        positions = []
        for draw in draws:
            if num in draw:
                sorted_draw = sorted(draw)
                positions.append(sorted_draw.index(num) / 4)  # Normalize to 0-1

        return np.mean(positions) if positions else 0.5

    def _delta_compatibility(self, num: int, draws: List[List[int]]) -> float:
        """Calculate compatibility with common deltas"""
        if not draws:
            return 0

        compat_scores = []
        for draw in draws:
            if len(draw) >= 2:
                # Check if num would create common deltas with any number in draw
                for other in draw:
                    delta = abs(num - other)
                    if delta <= 30:  # Common delta range
                        # Check if this delta is common in recent history
                        recent_deltas = []
                        for d in draws[-10:]:
                            if not d or len(d) < 2:
                                continue
                            sorted_d = sorted(d)
                            if len(sorted_d) >= 2:
                                recent_deltas.extend([sorted_d[i] - sorted_d[i - 1] for i in range(1, len(sorted_d))])

                        delta_count = sum(1 for d in recent_deltas if d == delta)
                        compat_scores.append(delta_count / (len(recent_deltas) + 1))

        return np.mean(compat_scores) if compat_scores else 0

    def _trend_score(self, num: int, recent_draws: List[List[int]]) -> float:
        """Calculate if number is trending up or down in frequency"""
        if len(recent_draws) < 5:
            return 0.5

        # Split into two halves
        half = len(recent_draws) // 2
        first = recent_draws[:half]
        second = recent_draws[half:]

        freq_first = sum(1 for draw in first if num in draw) / (len(first) + 1)
        freq_second = sum(1 for draw in second if num in draw) / (len(second) + 1)

        return (freq_second - freq_first + 1) / 2  # Normalize to 0-1


class GeneticOptimizer:
    """
    Evolutionary algorithm to optimize number selection
    """

    def __init__(self, population_size: int = 150, generations: int = 75):
        self.pop_size = population_size
        self.generations = generations
        # Note: Seed will be set by parent before calling evolve_solution

    def evolve_solution(self, number_probs: Dict[int, float],
                        constraints: Dict) -> List[int]:
        """Evolve optimal number set using genetic algorithm"""

        # Initial population
        population = []
        for _ in range(self.pop_size):
            individual = self._generate_individual(number_probs, constraints)
            population.append(individual)

        # Evolution loop
        for generation in range(self.generations):
            # Evaluate fitness
            fitness_scores = [self._fitness(ind, number_probs, constraints)
                              for ind in population]

            # Selection (tournament)
            selected = []
            for _ in range(self.pop_size):
                tournament = random.sample(list(zip(population, fitness_scores)), 3)
                winner = max(tournament, key=lambda x: x[1])[0]
                selected.append(winner)

            # Crossover and mutation
            new_population = []
            for i in range(0, self.pop_size, 2):
                parent1 = selected[i]
                parent2 = selected[i + 1] if i + 1 < len(selected) else selected[0]

                # Crossover
                child1, child2 = self._crossover(parent1, parent2)

                # Mutation
                if random.random() < 0.3:
                    child1 = self._mutate(child1, number_probs, constraints)
                if random.random() < 0.3:
                    child2 = self._mutate(child2, number_probs, constraints)

                new_population.extend([child1, child2])

            population = new_population[:self.pop_size]

        # Return best individual
        best_idx = np.argmax([self._fitness(ind, number_probs, constraints)
                              for ind in population])
        return sorted(population[best_idx])

    def _generate_individual(self, probs: Dict[int, float],
                             constraints: Dict) -> List[int]:
        """Generate initial individual respecting constraints"""
        while True:
            # Weighted selection based on probabilities
            numbers = list(probs.keys())
            weights = list(probs.values())
            individual = random.choices(numbers, weights=weights, k=5)
            individual = list(set(individual))  # Remove duplicates

            if len(individual) < 5:
                # Fill with random numbers
                remaining = [n for n in numbers if n not in individual]
                individual.extend(random.sample(remaining, 5 - len(individual)))

            if self._satisfies_constraints(individual, constraints):
                return sorted(individual)

    def _fitness(self, individual: List[int], probs: Dict[int, float],
                 constraints: Dict) -> float:
        """Calculate fitness of an individual"""
        # Probability score
        prob_score = sum(probs.get(num, 0) for num in individual)

        # Constraint satisfaction
        constraint_score = self._constraint_score(individual, constraints)

        # Diversity bonus (avoid consecutive numbers)
        sorted_ind = sorted(individual)
        if len(sorted_ind) < 5:
            return 0.0  # Invalid individual
        consecutive_penalty = sum(1 for i in range(4)
                                  if i + 1 < len(sorted_ind) and sorted_ind[i + 1] - sorted_ind[i] == 1) * 0.1

        return prob_score * constraint_score - consecutive_penalty

    def _constraint_score(self, individual: List[int],
                          constraints: Dict) -> float:
        """Calculate how well constraints are satisfied"""
        score = 1.0

        # Sum constraint
        if 'target_sum_range' in constraints:
            low, high = constraints['target_sum_range']
            total = sum(individual)
            if low <= total <= high:
                score *= 1.2
            else:
                score *= 0.8

        # Even/Odd balance
        evens = sum(1 for n in individual if n % 2 == 0)
        if 'even_odd_target' in constraints:
            target = constraints['even_odd_target']
            if evens in target:
                score *= 1.1

        # High/Low balance
        highs = sum(1 for n in individual if n > 45)
        if 'high_low_target' in constraints:
            target = constraints['high_low_target']
            if highs in target:
                score *= 1.1

        return score

    def _satisfies_constraints(self, individual: List[int],
                               constraints: Dict) -> bool:
        """Check if individual satisfies all hard constraints"""
        # Basic checks
        if len(set(individual)) != 5:
            return False

        # Sum constraint
        if 'target_sum_range' in constraints:
            low, high = constraints['target_sum_range']
            total = sum(individual)
            if not (low <= total <= high):
                return False

        return True

    def _crossover(self, parent1: List[int], parent2: List[int]) -> Tuple[List[int], List[int]]:
        """Crossover two parents to create children"""
        # Single point crossover
        point = random.randint(1, 4)
        child1 = parent1[:point] + [n for n in parent2 if n not in parent1[:point]]
        child2 = parent2[:point] + [n for n in parent1 if n not in parent2[:point]]

        # Ensure 5 unique numbers
        child1 = list(set(child1))[:5]
        child2 = list(set(child2))[:5]

        # Fill if needed
        if len(child1) < 5:
            remaining = [n for n in range(1, 91) if n not in child1]
            child1.extend(random.sample(remaining, 5 - len(child1)))
        if len(child2) < 5:
            remaining = [n for n in range(1, 91) if n not in child2]
            child2.extend(random.sample(remaining, 5 - len(child2)))

        return sorted(child1), sorted(child2)

    def _mutate(self, individual: List[int], probs: Dict[int, float],
                constraints: Dict) -> List[int]:
        """Mutate an individual"""
        mutated = individual.copy()

        # Random mutation type
        mutation_type = random.choice(['swap', 'replace', 'shift'])

        if mutation_type == 'swap':
            # Swap two positions
            i, j = random.sample(range(5), 2)
            mutated[i], mutated[j] = mutated[j], mutated[i]

        elif mutation_type == 'replace':
            # Replace one number
            idx = random.randint(0, 4)
            old_num = mutated[idx]

            # Choose new number based on probabilities
            candidates = [n for n in range(1, 91) if n not in mutated]
            weights = [probs.get(n, 0) for n in candidates]

            if sum(weights) > 0:
                new_num = random.choices(candidates, weights=weights)[0]
                mutated[idx] = new_num

        elif mutation_type == 'shift':
            # Shift all numbers by small amount
            shift = random.randint(-5, 5)
            mutated = [(n + shift - 1) % 90 + 1 for n in mutated]
            mutated = list(set(mutated))
            if len(mutated) < 5:
                remaining = [n for n in range(1, 91) if n not in mutated]
                mutated.extend(random.sample(remaining, 5 - len(mutated)))

        return sorted(mutated)


# ============================================================================
# ML-BASED YEARLY PREDICTOR - Feature Extraction and Training
# ============================================================================

class MLYearlyPredictor:
    """
    ML-based predictor that learns patterns from previous years' data
    and applies them to predict current year's draws.
    
    Approach:
    1. Extract features from previous years (date patterns, frequency patterns, etc.)
    2. Train ML models on these features
    3. Use trained models to predict current year draws based on learned patterns
    """
    
    def __init__(self):
        self.models = {}  # Store trained models per feature type
        self.feature_scaler = StandardScaler()
        self.trained = False
        self.feature_importance = {}
        
    def extract_date_features(self, draw_date: str) -> Dict[str, float]:
        """
        Extract date-based features from a draw date.
        Features include: day of month, day of week, week of month, month, etc.
        """
        from datetime import datetime
        
        try:
            if isinstance(draw_date, str):
                date_obj = datetime.strptime(draw_date[:10], '%Y-%m-%d')
            else:
                date_obj = draw_date
            
            day_of_month = date_obj.day
            day_of_week = date_obj.weekday()  # 0=Monday, 6=Sunday
            week_of_month = (day_of_month - 1) // 7 + 1
            month = date_obj.month
            day_of_year = date_obj.timetuple().tm_yday
            
            # Cyclical encoding for periodic patterns
            day_sin = np.sin(2 * np.pi * day_of_month / 31)
            day_cos = np.cos(2 * np.pi * day_of_month / 31)
            month_sin = np.sin(2 * np.pi * month / 12)
            month_cos = np.cos(2 * np.pi * month / 12)
            
            return {
                'day_of_month': day_of_month,
                'day_of_week': day_of_week,
                'week_of_month': week_of_month,
                'month': month,
                'day_of_year': day_of_year,
                'day_sin': day_sin,
                'day_cos': day_cos,
                'month_sin': month_sin,
                'month_cos': month_cos,
            }
        except:
            return {
                'day_of_month': 15,
                'day_of_week': 3,
                'week_of_month': 2,
                'month': 6,
                'day_of_year': 180,
                'day_sin': 0,
                'day_cos': 1,
                'month_sin': 0,
                'month_cos': 1,
            }
    
    def extract_temporal_pattern_features(self, draws_by_date: Dict[str, Tuple[List[int], str]], 
                                         target_date: str, target_lotto_type: str = None) -> Dict[str, float]:
        """
        Extract features based on temporal patterns from previous years.
        Prioritizes same-date same-lotto-type matches, but also considers same-date different-lotto-type.
        
        Args:
            draws_by_date: Dict mapping date_str -> (draw, lotto_type)
            target_date: Date to predict for
            target_lotto_type: Lotto type to predict for (optional)
        """
        from datetime import datetime
        
        features = {}
        
        try:
            if isinstance(target_date, str):
                target = datetime.strptime(target_date[:10], '%Y-%m-%d')
            else:
                target = target_date
            
            # Separate draws by lotto type matching
            same_date_same_type_draws = []  # Higher priority
            same_date_diff_type_draws = []  # Lower priority
            
            for date_str, draw_data in draws_by_date.items():
                try:
                    draw_date = datetime.strptime(date_str[:10], '%Y-%m-%d')
                    # Same month and day, different year
                    if draw_date.month == target.month and draw_date.day == target.day:
                        if isinstance(draw_data, tuple):
                            draw, lotto_type = draw_data
                        else:
                            draw = draw_data
                            lotto_type = None
                        
                        if target_lotto_type and lotto_type == target_lotto_type:
                            same_date_same_type_draws.append(draw)
                        else:
                            same_date_diff_type_draws.append(draw)
                except:
                    continue
            
            # Features from same-date same-lotto-type draws (HIGHER PRIORITY)
            if same_date_same_type_draws:
                all_numbers = [num for draw in same_date_same_type_draws for num in draw]
                freq = Counter(all_numbers)
                
                # Most common numbers on this date+type across years
                top_numbers = [n for n, _ in freq.most_common(10)]
                for i, num in enumerate(top_numbers):
                    features[f'same_date_type_freq_{i}'] = freq[num] / len(same_date_same_type_draws)
                
                # Average sum on this date+type
                sums = [sum(draw) for draw in same_date_same_type_draws]
                features['same_date_type_avg_sum'] = np.mean(sums) if sums else 225
                features['same_date_type_std_sum'] = np.std(sums) if len(sums) > 1 else 0
                features['same_date_type_count'] = len(same_date_same_type_draws)
            else:
                # Default values if no same-date same-type history
                for i in range(10):
                    features[f'same_date_type_freq_{i}'] = 0
                features['same_date_type_avg_sum'] = 225
                features['same_date_type_std_sum'] = 0
                features['same_date_type_count'] = 0
            
            # Features from same-date different-lotto-type draws (LOWER PRIORITY, weighted 0.3)
            if same_date_diff_type_draws:
                all_numbers = [num for draw in same_date_diff_type_draws for num in draw]
                freq = Counter(all_numbers)
                
                top_numbers = [n for n, _ in freq.most_common(5)]
                for i, num in enumerate(top_numbers):
                    # Weighted lower (0.3x) since different lotto type
                    features[f'same_date_diff_type_freq_{i}'] = (freq[num] / len(same_date_diff_type_draws)) * 0.3
                
                sums = [sum(draw) for draw in same_date_diff_type_draws]
                features['same_date_diff_type_avg_sum'] = np.mean(sums) * 0.3 if sums else 225 * 0.3
            else:
                for i in range(5):
                    features[f'same_date_diff_type_freq_{i}'] = 0
                features['same_date_diff_type_avg_sum'] = 0
            
            # Look for draws in same week of month across years (same lotto type preferred)
            week_same_type_draws = []
            week_diff_type_draws = []
            target_week = (target.day - 1) // 7 + 1
            
            for date_str, draw_data in draws_by_date.items():
                try:
                    draw_date = datetime.strptime(date_str[:10], '%Y-%m-%d')
                    draw_week = (draw_date.day - 1) // 7 + 1
                    if draw_date.month == target.month and draw_week == target_week:
                        if isinstance(draw_data, tuple):
                            draw, lotto_type = draw_data
                        else:
                            draw = draw_data
                            lotto_type = None
                        
                        if target_lotto_type and lotto_type == target_lotto_type:
                            week_same_type_draws.append(draw)
                        else:
                            week_diff_type_draws.append(draw)
                except:
                    continue
            
            if week_same_type_draws:
                all_numbers = [num for draw in week_same_type_draws for num in draw]
                freq = Counter(all_numbers)
                top_numbers = [n for n, _ in freq.most_common(5)]
                for i, num in enumerate(top_numbers):
                    features[f'week_type_freq_{i}'] = freq[num] / len(week_same_type_draws)
            else:
                for i in range(5):
                    features[f'week_type_freq_{i}'] = 0
            
            if week_diff_type_draws:
                all_numbers = [num for draw in week_diff_type_draws for num in draw]
                freq = Counter(all_numbers)
                top_numbers = [n for n, _ in freq.most_common(3)]
                for i, num in enumerate(top_numbers):
                    features[f'week_diff_type_freq_{i}'] = (freq[num] / len(week_diff_type_draws)) * 0.3
            else:
                for i in range(3):
                    features[f'week_diff_type_freq_{i}'] = 0
            
            return features
        except Exception as e:
            # Return default features on error
            features = {}
            for i in range(10):
                features[f'same_date_type_freq_{i}'] = 0
            features['same_date_type_avg_sum'] = 225
            features['same_date_type_std_sum'] = 0
            features['same_date_type_count'] = 0
            for i in range(5):
                features[f'same_date_diff_type_freq_{i}'] = 0
            features['same_date_diff_type_avg_sum'] = 0
            for i in range(5):
                features[f'week_type_freq_{i}'] = 0
            for i in range(3):
                features[f'week_diff_type_freq_{i}'] = 0
            return features
    
    def extract_number_features(self, historical_draws: List[List[int]], 
                                target_numbers: List[int] = None) -> Dict[str, float]:
        """
        Extract features related to number frequencies and patterns.
        """
        if not historical_draws:
            return {}
        
        all_numbers = [num for draw in historical_draws for num in draw]
        freq = Counter(all_numbers)
        total_draws = len(historical_draws)
        
        features = {}
        
        # Overall frequency features
        for num in range(1, 91):
            features[f'freq_{num}'] = freq.get(num, 0) / total_draws if total_draws > 0 else 0
        
        # Hot/Cold numbers
        sorted_nums = sorted(freq.items(), key=lambda x: x[1], reverse=True)
        hot_numbers = [n for n, _ in sorted_nums[:15]]
        cold_numbers = [n for n, _ in sorted_nums[-15:]] if len(sorted_nums) >= 15 else []
        
        for i, num in enumerate(hot_numbers):
            features[f'hot_rank_{i}'] = num
        for i, num in enumerate(cold_numbers):
            features[f'cold_rank_{i}'] = num
        
        # If target numbers provided, add their features
        if target_numbers:
            for num in target_numbers:
                features[f'target_freq_{num}'] = freq.get(num, 0) / total_draws if total_draws > 0 else 0
        
        return features
    
    def prepare_training_data(self, yearly_draws: Dict[int, List[Tuple[str, List[int], str]]]) -> Tuple[np.ndarray, np.ndarray]:
        """
        Prepare training data from previous years' draws.
        Each sample: features from a draw date + lotto type -> numbers that appeared
        
        Args:
            yearly_draws: Dict mapping year -> list of (date_str, draw, lotto_type) tuples
        """
        X_samples = []
        y_samples = []
        
        # Organize draws by date string with lotto type
        all_draws_by_date = {}
        for year, draws_with_dates in yearly_draws.items():
            for draw_data in draws_with_dates:
                if len(draw_data) == 3:
                    date_str, draw, lotto_type = draw_data
                elif len(draw_data) == 2:
                    date_str, draw = draw_data
                    lotto_type = None
                else:
                    continue
                all_draws_by_date[date_str] = (draw, lotto_type)
        
        # For each year (except the most recent)
        years = sorted(yearly_draws.keys())
        if len(years) < 2:
            return np.array([]), np.array([])
        
        # Use all but the last year for training
        training_years = years[:-1]
        
        for year in training_years:
            for draw_data in yearly_draws[year]:
                if len(draw_data) == 3:
                    date_str, draw, lotto_type = draw_data
                elif len(draw_data) == 2:
                    date_str, draw = draw_data
                    lotto_type = None
                else:
                    continue
                
                # Extract features for this date and lotto type
                date_features = self.extract_date_features(date_str)
                temporal_features = self.extract_temporal_pattern_features(all_draws_by_date, date_str, lotto_type)
                
                # Add lotto type as feature (encoded as hash for categorical)
                if lotto_type:
                    lotto_hash = hash(lotto_type) % 1000  # Normalize to 0-999
                    date_features['lotto_type_hash'] = lotto_hash
                else:
                    date_features['lotto_type_hash'] = 0
                
                # Combine features
                combined_features = {**date_features, **temporal_features}
                
                # For each number in the draw, create a training sample
                # We'll predict which numbers are likely to appear
                for num in range(1, 91):
                    # Feature: is this number in the actual draw?
                    target = 1 if num in draw else 0
                    
                    # Add number-specific features
                    num_features = combined_features.copy()
                    num_features['number'] = num
                    # Calculate frequency across all draws (weighted by lotto type match)
                    number_freq = 0
                    total_weight = 0
                    for d, (d_draw, d_type) in all_draws_by_date.items():
                        weight = 1.0 if d_type == lotto_type else 0.3
                        if num in d_draw:
                            number_freq += weight
                        total_weight += weight
                    num_features['number_freq'] = number_freq / total_weight if total_weight > 0 else 0
                    
                    X_samples.append(list(num_features.values()))
                    y_samples.append(target)
        
        if not X_samples:
            return np.array([]), np.array([])
        
        X = np.array(X_samples)
        y = np.array(y_samples)
        
        return X, y
    
    def train(self, yearly_draws: Dict[int, List[Tuple[str, List[int], str]]]) -> bool:
        """
        Train ensemble ML models on previous years' data.
        Uses RandomForest + GradientBoosting for better accuracy.
        """
        try:
            print("Training ensemble ML models on yearly patterns...")
            
            X, y = self.prepare_training_data(yearly_draws)
            
            if X.size == 0 or len(X) < 100:
                print("Insufficient data for ML training (need at least 100 samples)")
                return False
            
            # Scale features
            X_scaled = self.feature_scaler.fit_transform(X)
            
            # Train ensemble of models for better accuracy
            print(f"  Training on {len(X)} samples with {X.shape[1]} features...")
            
            # Model 1: RandomForest (good for non-linear patterns and feature importance)
            self.models['rf'] = RandomForestClassifier(
                n_estimators=200,  # Increased for better accuracy
                max_depth=25,  # Deeper trees for complex patterns
                min_samples_split=8,  # More splits
                min_samples_leaf=4,
                max_features='sqrt',  # Feature subsampling
                random_state=42,
                n_jobs=-1,
                verbose=0,
                class_weight='balanced'  # Handle imbalanced data (most numbers don't appear)
            )
            self.models['rf'].fit(X_scaled, y)
            print("  ✅ RandomForest trained")
            
            # Model 2: GradientBoosting (good for sequential learning)
            self.models['gb'] = GradientBoostingClassifier(
                n_estimators=150,
                max_depth=8,
                learning_rate=0.1,
                min_samples_split=10,
                min_samples_leaf=5,
                random_state=42,
                verbose=0
            )
            self.models['gb'].fit(X_scaled, y)
            print("  ✅ GradientBoosting trained")
            
            # Create ensemble classifier that combines both models
            class EnsembleClassifier:
                def __init__(self, rf_model, gb_model):
                    self.rf = rf_model
                    self.gb = gb_model
                
                def predict_proba(self, X):
                    # Weighted average: RF 60%, GB 40% (RF generally more stable)
                    rf_proba = self.rf.predict_proba(X)
                    gb_proba = self.gb.predict_proba(X)
                    return 0.6 * rf_proba + 0.4 * gb_proba
            
            self.models['number_classifier'] = EnsembleClassifier(self.models['rf'], self.models['gb'])
            
            # Get feature importance from RandomForest (most interpretable)
            feature_names = ['day_of_month', 'day_of_week', 'week_of_month', 'month', 
                           'day_of_year', 'day_sin', 'day_cos', 'month_sin', 'month_cos',
                           'lotto_type_hash',
                           'same_date_type_freq_0', 'same_date_type_freq_1', 'same_date_type_freq_2',
                           'same_date_type_avg_sum', 'same_date_type_std_sum', 'same_date_type_count',
                           'same_date_diff_type_freq_0', 'same_date_diff_type_freq_1',
                           'same_date_diff_type_avg_sum',
                           'week_type_freq_0', 'week_type_freq_1',
                           'week_diff_type_freq_0',
                           'number', 'number_freq']
            
            importances = self.models['rf'].feature_importances_
            # Pad feature names if needed
            while len(feature_names) < len(importances):
                feature_names.append(f'feature_{len(feature_names)}')
            
            self.feature_importance = dict(zip(feature_names[:len(importances)], importances))
            
            print(f"✅ Ensemble ML models trained on {len(X)} samples")
            top_features = sorted(self.feature_importance.items(), key=lambda x: x[1], reverse=True)[:5]
            print(f"   Top features: {top_features}")
            
            self.trained = True
            return True
            
        except Exception as e:
            print(f"⚠️ ML training failed: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def predict_numbers_for_date(self, target_date: str, 
                                 historical_draws_by_date: Dict[str, Tuple[List[int], str]],
                                 historical_draws: List[List[int]],
                                 target_lotto_type: str = None) -> List[int]:
        """
        Predict numbers for a specific date and lotto type using trained ML models.
        
        Args:
            target_date: Date to predict for
            historical_draws_by_date: Dict mapping date_str -> (draw, lotto_type)
            historical_draws: List of all historical draws
            target_lotto_type: Lotto type to predict for (optional)
        """
        if not self.trained or 'number_classifier' not in self.models:
            # Fallback to frequency-based (weighted by lotto type if provided)
            freq = Counter()
            for draw_data in historical_draws_by_date.values():
                if isinstance(draw_data, tuple):
                    draw, lotto_type = draw_data
                    weight = 1.0 if lotto_type == target_lotto_type else 0.3
                else:
                    draw = draw_data
                    weight = 1.0
                for num in draw:
                    freq[num] += weight
            return sorted([n for n, _ in freq.most_common(5)])
        
        try:
            # Extract features for target date and lotto type
            date_features = self.extract_date_features(target_date)
            temporal_features = self.extract_temporal_pattern_features(
                historical_draws_by_date, 
                target_date, 
                target_lotto_type
            )
            
            # Add lotto type as feature
            if target_lotto_type:
                lotto_hash = hash(target_lotto_type) % 1000
                date_features['lotto_type_hash'] = lotto_hash
            else:
                date_features['lotto_type_hash'] = 0
            
            # Score each number (1-90)
            number_scores = {}
            
            for num in range(1, 91):
                # Combine features
                combined_features = {**date_features, **temporal_features}
                combined_features['number'] = num
                
                # Calculate weighted frequency (prioritize same lotto type)
                number_freq = 0
                total_weight = 0
                for draw_data in historical_draws_by_date.values():
                    if isinstance(draw_data, tuple):
                        draw, lotto_type = draw_data
                        weight = 1.0 if lotto_type == target_lotto_type else 0.3
                    else:
                        draw = draw_data
                        weight = 1.0
                    
                    if num in draw:
                        number_freq += weight
                    total_weight += weight
                
                combined_features['number_freq'] = number_freq / total_weight if total_weight > 0 else 0
                
                # Prepare feature vector (must match training feature order)
                feature_vector = np.array([list(combined_features.values())])
                feature_vector_scaled = self.feature_scaler.transform(feature_vector)
                
                # Predict probability this number appears
                prob = self.models['number_classifier'].predict_proba(feature_vector_scaled)[0][1]
                number_scores[num] = prob
            
            # Select top 5 numbers by probability
            top_numbers = sorted(number_scores.items(), key=lambda x: x[1], reverse=True)[:5]
            return sorted([n for n, _ in top_numbers])
            
        except Exception as e:
            print(f"ML prediction failed: {e}, using fallback")
            import traceback
            traceback.print_exc()
            # Fallback (weighted by lotto type)
            freq = Counter()
            for draw_data in historical_draws_by_date.values():
                if isinstance(draw_data, tuple):
                    draw, lotto_type = draw_data
                    weight = 1.0 if lotto_type == target_lotto_type else 0.3
                else:
                    draw = draw_data
                    weight = 1.0
                for num in draw:
                    freq[num] += weight
            return sorted([n for n, _ in freq.most_common(5)])


# ============================================================================
# YEARLY PATTERN ANALYZER - Law of Large Numbers Approach
# ============================================================================

class YearlyPatternAnalyzer:
    """
    Analyzes patterns across years using the Law of Large Numbers principle.
    In lottery systems, patterns from previous years often recur as the sample
    size grows. This analyzer detects cross-year patterns and uses them for
    predictions.
    """

    def __init__(self):
        self.yearly_data = {}  # year -> list of draws
        self.yearly_data_with_dates = {}  # year -> list of (date_str, draw) tuples
        self.yearly_frequencies = {}  # year -> {number: count}
        self.yearly_hot_numbers = {}  # year -> list of hot numbers
        self.yearly_cold_numbers = {}  # year -> list of cold numbers
        self.cross_year_patterns = []
        self.min_draws_for_analysis = 10  # Minimum draws needed for reliable analysis
        self.ml_predictor = MLYearlyPredictor()  # ML-based predictor

    def organize_by_year(self, draws: List[List[int]], draw_dates: List[str] = None, lotto_types: List[str] = None) -> Dict[int, List[List[int]]]:
        """
        Organize draws by year. If dates not provided, assumes draws are in 
        chronological order and distributes them evenly across recent years.
        Also stores draws with dates and lotto types for ML training.
        """
        from datetime import datetime
        
        # Clear previous data
        self.yearly_data = {}
        self.yearly_data_with_dates = {}
        
        if draw_dates and len(draw_dates) == len(draws):
            # Organize by actual dates
            for i, draw in enumerate(draws):
                try:
                    date_str = draw_dates[i] if isinstance(draw_dates[i], str) else str(draw_dates[i])
                    if isinstance(draw_dates[i], str):
                        year = int(draw_dates[i][:4])
                    else:
                        year = draw_dates[i].year
                    
                    # Get lotto type if available
                    lotto_type = lotto_types[i] if lotto_types and i < len(lotto_types) and lotto_types[i] else None
                    
                    if year not in self.yearly_data:
                        self.yearly_data[year] = []
                        self.yearly_data_with_dates[year] = []
                    self.yearly_data[year].append(draw)
                    self.yearly_data_with_dates[year].append((date_str, draw, lotto_type))
                except:
                    continue
        else:
            # Estimate years based on position (assume ~300 draws per year)
            current_year = datetime.now().year
            
            # Adjust draws_per_year based on actual data size
            # If we have fewer than 300 draws, assume they're all from current year
            # If we have 300-600, split into 2 years, etc.
            total_draws = len(draws)
            if total_draws < 300:
                draws_per_year = total_draws  # All current year
            else:
                draws_per_year = 300
            
            for i, draw in enumerate(draws):
                # Most recent draws are at the beginning (draws are usually sorted newest first)
                years_back = i // draws_per_year
                year = current_year - years_back
                
                # Generate estimated date
                estimated_date = f"{year}-06-15"  # Default to mid-year
                
                # Get lotto type if available
                lotto_type = lotto_types[i] if lotto_types and i < len(lotto_types) and lotto_types[i] else None
                
                if year not in self.yearly_data:
                    self.yearly_data[year] = []
                    self.yearly_data_with_dates[year] = []
                self.yearly_data[year].append(draw)
                self.yearly_data_with_dates[year].append((estimated_date, draw, lotto_type))
        
        # Ensure we have at least one year with data
        if not self.yearly_data:
            current_year = datetime.now().year
            self.yearly_data[current_year] = draws if draws else []
            self.yearly_data_with_dates[current_year] = [
                (f"{current_year}-06-15", d, lotto_types[i] if lotto_types and i < len(lotto_types) else None) 
                for i, d in enumerate(draws)
            ] if draws else []
            print(f"Warning: No yearly data organized, using all {len(draws)} draws for {current_year}")
        
        print(f"Yearly data organized: {[(year, len(data)) for year, data in sorted(self.yearly_data.items())]}")
        return self.yearly_data

    def calculate_yearly_frequencies(self) -> Dict[int, Dict[int, int]]:
        """Calculate number frequencies for each year"""
        for year, draws in self.yearly_data.items():
            freq = Counter()
            for draw in draws:
                freq.update(draw)
            self.yearly_frequencies[year] = dict(freq)
            
            # Calculate hot and cold numbers for each year
            sorted_nums = sorted(freq.items(), key=lambda x: x[1], reverse=True)
            self.yearly_hot_numbers[year] = [n for n, _ in sorted_nums[:15]]
            self.yearly_cold_numbers[year] = [n for n, _ in sorted_nums[-15:] if freq[n] > 0]
        
        return self.yearly_frequencies

    def detect_cross_year_patterns(self) -> List[Dict]:
        """
        Detect patterns that repeat across years.
        Uses Law of Large Numbers: as sample size grows, patterns stabilize.
        """
        patterns = []
        years = sorted(self.yearly_data.keys())
        
        if len(years) < 2:
            # With only one year, create patterns based on that year's data
            if len(years) == 1:
                year = years[0]
                hot_nums = self.yearly_hot_numbers.get(year, [])
                if hot_nums:
                    patterns.append({
                        'type': 'stable_foundation',
                        'numbers': hot_nums[:10],
                        'confidence': 0.6,
                        'description': 'Most frequent numbers in current data'
                    })
                print(f"Single year mode: created foundation pattern with {len(hot_nums)} hot numbers")
            return patterns

        # Pattern 1: Recurring Hot Numbers
        # Numbers that are consistently hot across multiple years
        recurring_hot = self._find_recurring_numbers(self.yearly_hot_numbers, min_years=2)
        if recurring_hot:
            patterns.append({
                'type': 'recurring_hot',
                'numbers': recurring_hot,
                'confidence': len(recurring_hot) / 15,  # Normalized confidence
                'description': 'Numbers consistently appearing frequently across years'
            })

        # Pattern 2: Cold-to-Hot Transitions
        # Numbers that were cold last year but are due to become hot
        cold_to_hot = self._detect_cold_to_hot_transitions()
        if cold_to_hot:
            patterns.append({
                'type': 'cold_to_hot',
                'numbers': cold_to_hot,
                'confidence': 0.6,
                'description': 'Previously cold numbers showing signs of emergence'
            })

        # Pattern 3: Cyclical Patterns
        # Numbers that appear in cycles (e.g., every 2 years)
        cyclical = self._detect_cyclical_patterns()
        if cyclical:
            patterns.append({
                'type': 'cyclical',
                'numbers': cyclical,
                'confidence': 0.5,
                'description': 'Numbers following cyclical appearance patterns'
            })

        # Pattern 4: Year-End Surge
        # Numbers that tend to appear more at certain times
        surge_numbers = self._detect_frequency_trends()
        if surge_numbers:
            patterns.append({
                'type': 'trending',
                'numbers': surge_numbers,
                'confidence': 0.7,
                'description': 'Numbers with increasing frequency trend'
            })

        # Pattern 5: Stable Foundation Numbers
        # Numbers that consistently appear across all years (foundation of the system)
        stable = self._find_stable_numbers()
        if stable:
            patterns.append({
                'type': 'stable_foundation',
                'numbers': stable,
                'confidence': 0.8,
                'description': 'Consistently appearing numbers forming the system foundation'
            })

        self.cross_year_patterns = patterns
        return patterns

    def _find_recurring_numbers(self, yearly_numbers: Dict[int, List[int]], min_years: int = 2) -> List[int]:
        """Find numbers that appear in hot/cold lists across multiple years"""
        if not yearly_numbers:
            return []
        
        number_year_count = Counter()
        for year, numbers in yearly_numbers.items():
            for num in numbers:
                number_year_count[num] += 1
        
        # Return numbers appearing in at least min_years
        recurring = [num for num, count in number_year_count.items() if count >= min_years]
        return sorted(recurring, key=lambda x: number_year_count[x], reverse=True)[:10]

    def _detect_cold_to_hot_transitions(self) -> List[int]:
        """Detect numbers transitioning from cold to hot"""
        years = sorted(self.yearly_data.keys())
        if len(years) < 2:
            return []
        
        prev_year = years[-2]
        curr_year = years[-1]
        
        # Numbers that were cold last year
        prev_cold = set(self.yearly_cold_numbers.get(prev_year, []))
        
        # Check if any are becoming hot this year
        curr_freq = self.yearly_frequencies.get(curr_year, {})
        
        transitioning = []
        for num in prev_cold:
            if curr_freq.get(num, 0) > len(self.yearly_data.get(curr_year, [])) * 0.1:
                transitioning.append(num)
        
        return transitioning[:5]

    def _detect_cyclical_patterns(self) -> List[int]:
        """Detect numbers with cyclical appearance patterns"""
        years = sorted(self.yearly_data.keys())
        if len(years) < 3:
            return []
        
        cyclical_numbers = []
        
        for num in range(1, 91):
            appearances = []
            for year in years:
                freq = self.yearly_frequencies.get(year, {}).get(num, 0)
                total = len(self.yearly_data.get(year, []))
                rate = freq / total if total > 0 else 0
                appearances.append(rate)
            
            # Check for alternating pattern (high-low-high or low-high-low)
            if len(appearances) >= 3:
                is_cyclical = True
                for i in range(len(appearances) - 2):
                    if not ((appearances[i] > appearances[i+1] and appearances[i+1] < appearances[i+2]) or
                            (appearances[i] < appearances[i+1] and appearances[i+1] > appearances[i+2])):
                        is_cyclical = False
                        break
                
                if is_cyclical:
                    cyclical_numbers.append(num)
        
        return cyclical_numbers[:5]

    def _detect_frequency_trends(self) -> List[int]:
        """Detect numbers with increasing frequency trend"""
        years = sorted(self.yearly_data.keys())
        if len(years) < 2:
            return []
        
        trending = []
        
        for num in range(1, 91):
            rates = []
            for year in years:
                freq = self.yearly_frequencies.get(year, {}).get(num, 0)
                total = len(self.yearly_data.get(year, []))
                rate = freq / total if total > 0 else 0
                rates.append(rate)
            
            # Check for upward trend
            if len(rates) >= 2:
                # Simple trend: each year higher than previous
                is_trending = all(rates[i] <= rates[i+1] for i in range(len(rates)-1))
                # Or significant increase in last year
                if not is_trending and len(rates) >= 2:
                    is_trending = rates[-1] > rates[-2] * 1.3  # 30% increase
                
                if is_trending and rates[-1] > 0.05:  # At least 5% appearance rate
                    trending.append((num, rates[-1]))
        
        # Sort by current rate
        trending.sort(key=lambda x: x[1], reverse=True)
        return [num for num, _ in trending[:10]]

    def _find_stable_numbers(self) -> List[int]:
        """Find numbers that consistently appear across all years"""
        years = sorted(self.yearly_data.keys())
        if len(years) < 2:
            return []
        
        stable = []
        
        for num in range(1, 91):
            appearances = 0
            total_years = len(years)
            
            for year in years:
                freq = self.yearly_frequencies.get(year, {}).get(num, 0)
                total = len(self.yearly_data.get(year, []))
                if total > 0 and freq / total > 0.03:  # Appears in at least 3% of draws
                    appearances += 1
            
            # Must appear consistently in most years
            if appearances >= total_years * 0.8:
                stable.append(num)
        
        return stable[:10]

    def predict_with_yearly_patterns(self, current_year_draws: List[List[int]], 
                                      num_predictions: int = 5,
                                      ml_trained: bool = False,
                                      target_date: str = None,
                                      target_lotto_type: str = None) -> List[Dict]:
        """
        Generate predictions using yearly pattern analysis.
        Works even with limited data at the start of a new year.
        Uses ML predictions if trained, otherwise falls back to pattern-based predictions.
        Prioritizes same-date same-lotto-type patterns.
        """
        from datetime import datetime
        
        predictions = []
        
        # Get target date for ML prediction (today or next draw date)
        if target_date is None:
            target_date = datetime.now().strftime('%Y-%m-%d')
        
        # Build historical draws by date with lotto types for ML predictor
        all_draws_by_date = {}
        all_historical_draws = []
        for year, draws_with_dates in self.yearly_data_with_dates.items():
            for draw_data in draws_with_dates:
                if len(draw_data) == 3:
                    date_str, draw, lotto_type = draw_data
                elif len(draw_data) == 2:
                    date_str, draw = draw_data
                    lotto_type = None
                else:
                    continue
                all_draws_by_date[date_str] = (draw, lotto_type)
                all_historical_draws.append(draw)
        
        # Try ML prediction first if trained
        ml_prediction = None
        if ml_trained and self.ml_predictor.trained:
            try:
                print(f"Using ML prediction for date: {target_date}, lotto_type: {target_lotto_type}")
                ml_prediction = self.ml_predictor.predict_numbers_for_date(
                    target_date,
                    all_draws_by_date,
                    all_historical_draws,
                    target_lotto_type
                )
                if ml_prediction and len(ml_prediction) == 5:
                    print(f"ML prediction: {ml_prediction}")
            except Exception as e:
                print(f"ML prediction failed: {e}, falling back to pattern-based")
                import traceback
                traceback.print_exc()
                ml_prediction = None
        
        # Calculate weights for different pattern types
        pattern_weights = {
            'stable_foundation': 0.25,
            'recurring_hot': 0.25,
            'trending': 0.20,
            'cold_to_hot': 0.15,
            'cyclical': 0.15
        }
        
        # Collect all pattern numbers with their weights
        weighted_numbers = Counter()
        
        # Boost ML prediction numbers if available
        if ml_prediction:
            for num in ml_prediction:
                weighted_numbers[num] += 0.5  # High weight for ML predictions
        
        for pattern in self.cross_year_patterns:
            pattern_type = pattern['type']
            weight = pattern_weights.get(pattern_type, 0.1) * pattern['confidence']
            
            for num in pattern['numbers']:
                weighted_numbers[num] += weight
        
        # Add current year frequency boost if we have enough data
        if len(current_year_draws) >= self.min_draws_for_analysis:
            curr_freq = Counter()
            for draw in current_year_draws:
                curr_freq.update(draw)
            
            # Boost numbers that are already showing up this year
            for num, count in curr_freq.items():
                rate = count / len(current_year_draws)
                weighted_numbers[num] += rate * 0.3  # Current year boost
        
        # Fallback: if no patterns detected, use frequency from all yearly data
        if not weighted_numbers:
            print("No yearly patterns detected, using frequency-based fallback...")
            all_draws = []
            for year_draws in self.yearly_data.values():
                all_draws.extend(year_draws)
            
            if all_draws:
                freq = Counter()
                for draw in all_draws:
                    freq.update(draw)
                
                # Use frequency as weight
                for num, count in freq.items():
                    weighted_numbers[num] = count / len(all_draws)
        
        # Generate predictions
        sorted_numbers = sorted(weighted_numbers.items(), key=lambda x: x[1], reverse=True)
        
        # If we have ML prediction, use it as the primary prediction
        if ml_prediction and len(ml_prediction) == 5:
            predictions.append({
                'numbers': ml_prediction,
                'confidence': 0.75,  # Higher confidence for ML predictions
                'sum': sum(ml_prediction),
                'evens': sum(1 for n in ml_prediction if n % 2 == 0),
                'highs': sum(1 for n in ml_prediction if n > 45),
                'source': 'ml_yearly'
            })
            num_predictions -= 1  # One prediction already added
        
        for i in range(num_predictions):
            # Select top candidates
            candidates = [n for n, w in sorted_numbers[:30] if n not in [p.get('numbers', []) for p in predictions]]
            
            # If not enough candidates, add random numbers from 1-90
            if len(candidates) < 5:
                all_used = set()
                for p in predictions:
                    all_used.update(p.get('numbers', []))
                remaining_nums = [n for n in range(1, 91) if n not in all_used and n not in candidates]
                candidates.extend(remaining_nums[:5 - len(candidates)])
            
            if len(candidates) >= 5:
                # Take top 5 with some randomization
                prediction_numbers = []
                remaining = candidates.copy()
                
                for j in range(5):
                    if not remaining:
                        break
                    
                    # Weight by position (higher ranked = more likely)
                    weights = [1 / (k + 1) for k in range(len(remaining))]
                    chosen = random.choices(remaining, weights=weights)[0]
                    prediction_numbers.append(chosen)
                    remaining.remove(chosen)
                
                prediction_numbers = sorted(prediction_numbers)
                
                # Calculate confidence based on data availability
                data_confidence = min(len(current_year_draws) / 50, 1.0)  # Max confidence at 50+ draws
                pattern_confidence = sum(p['confidence'] for p in self.cross_year_patterns) / max(len(self.cross_year_patterns), 1)
                
                predictions.append({
                    'numbers': prediction_numbers,
                    'confidence': (data_confidence * 0.4 + pattern_confidence * 0.6),
                    'sum': sum(prediction_numbers),
                    'evens': sum(1 for n in prediction_numbers if n % 2 == 0),
                    'highs': sum(1 for n in prediction_numbers if n > 45),
                    'source': 'yearly_pattern'
                })
        
        # Final fallback: ensure at least one prediction
        if not predictions:
            print("No predictions generated, creating fallback prediction...")
            # Use top 5 most frequent numbers across all years
            all_draws = []
            for year_draws in self.yearly_data.values():
                all_draws.extend(year_draws)
            
            if all_draws:
                freq = Counter()
                for draw in all_draws:
                    freq.update(draw)
                fallback_nums = sorted([n for n, _ in freq.most_common(5)])
            else:
                # Absolute fallback
                fallback_nums = [15, 30, 45, 60, 75]
            
            predictions.append({
                'numbers': fallback_nums,
                'confidence': 0.3,
                'sum': sum(fallback_nums),
                'evens': sum(1 for n in fallback_nums if n % 2 == 0),
                'highs': sum(1 for n in fallback_nums if n > 45),
                'source': 'yearly_fallback'
            })
        
        return predictions

    def get_yearly_summary(self) -> Dict:
        """Get a summary of yearly analysis"""
        years = sorted(self.yearly_data.keys())
        
        summary = {
            'years_analyzed': years,
            'total_years': len(years),
            'draws_per_year': {year: len(draws) for year, draws in self.yearly_data.items()},
            'patterns_detected': len(self.cross_year_patterns),
            'pattern_types': [p['type'] for p in self.cross_year_patterns],
            'top_recurring_hot': self._find_recurring_numbers(self.yearly_hot_numbers, min_years=2)[:5],
            'stable_foundation': self._find_stable_numbers()[:5]
        }
        
        return summary

    def analyze(self, draws: List[List[int]], draw_dates: List[str] = None, lotto_types: List[str] = None) -> Dict:
        """
        Complete yearly analysis pipeline.
        Returns patterns and predictions.
        """
        # Step 1: Organize by year (with lotto types)
        self.organize_by_year(draws, draw_dates, lotto_types)
        
        # Step 2: Calculate frequencies
        self.calculate_yearly_frequencies()
        
        # Step 3: Train ML models on previous years' data (if we have multiple years)
        ml_trained = False
        if len(self.yearly_data_with_dates) >= 2:
            try:
                ml_trained = self.ml_predictor.train(self.yearly_data_with_dates)
                if ml_trained:
                    print("✅ ML yearly predictor trained successfully")
            except Exception as e:
                print(f"⚠️ ML yearly predictor training failed: {e}")
        
        # Step 4: Detect cross-year patterns
        patterns = self.detect_cross_year_patterns()
        
        # Step 5: Get current year draws for prediction
        current_year = max(self.yearly_data.keys()) if self.yearly_data else None
        current_year_draws = self.yearly_data.get(current_year, []) if current_year else []
        
        # Step 6: Get target lotto type (most common in current year, or from recent draws)
        target_lotto_type = None
        if lotto_types and len(lotto_types) > 0:
            # Use most recent lotto type as target
            target_lotto_type = lotto_types[-1] if lotto_types[-1] else None
        
        # Step 7: Generate predictions (will use ML if trained, otherwise pattern-based)
        # Use today's date as target for prediction
        from datetime import datetime
        target_date = datetime.now().strftime('%Y-%m-%d')
        predictions = self.predict_with_yearly_patterns(
            current_year_draws, 
            ml_trained=ml_trained,
            target_date=target_date,
            target_lotto_type=target_lotto_type
        )
        
        return {
            'summary': self.get_yearly_summary(),
            'patterns': patterns,
            'predictions': predictions,
            'current_year': current_year,
            'current_year_draws': len(current_year_draws),
            'ml_trained': ml_trained,
            'target_lotto_type': target_lotto_type
        }


class EnhancedLottoOracle:
    """
    Version 2.0: Advanced Lottery Prediction System
    Enhanced with Zone, Gap, Trend, Position, Confidence, and Yearly Analysis
    """

    def __init__(self, historical_draws: List[List[int]], draw_dates: List[str] = None, lotto_types: List[str] = None):
        self.historical = historical_draws
        self.draw_dates = draw_dates  # Optional: dates for yearly organization
        self.lotto_types = lotto_types  # Optional: lotto types for yearly organization
        self.pattern_detector = AdvancedPatternDetector()
        self.ml_predictor = MLPredictor()
        self.genetic_optimizer = GeneticOptimizer()
        
        # Enhanced analyzers for robust predictions
        self.zone_analyzer = ZoneAnalyzer()
        self.gap_analyzer = GapAnalyzer()
        self.trend_analyzer = TrendAnalyzer()
        self.anti_pattern = AntiPatternFilter()
        self.position_analyzer = PositionAnalyzer()
        self.confidence_scorer = ConfidenceScorer()
        
        # Yearly Pattern Analyzer for cross-year analysis
        self.yearly_analyzer = YearlyPatternAnalyzer()

        # State tracking
        self.performance_history = []
        self.prediction_history = []
        self.regime_history = []
        
        # Cache for enhanced analysis
        self._zone_analysis = None
        self._gap_analysis = None
        self._trend_data = None
        self._position_analysis = None
        self._yearly_analysis = None

        # Initialize
        self._initialize_system()

    def _initialize_system(self):
        """Initialize all components"""
        print("Initializing Enhanced Lotto Oracle 2.0...")

        # Check for regime changes
        regime = self.pattern_detector.detect_regime_change(self.historical[-100:])
        self.regime_history.append(regime)

        if regime['detected']:
            print(f"⚠️  Regime change detected! Confidence: {regime['confidence']:.2%}")
            if 'details' in regime:
                for metric, change in regime['details'].items():
                    print(f"   {metric}: {change}")

        # Train ML model
        print("Training ML models...")
        trained = self.ml_predictor.train(self.historical)
        if trained:
            print("✅ ML models trained successfully")
        else:
            print("⚠️  Insufficient data for ML training")
        
        # Initialize enhanced analyzers with error handling
        print("Initializing enhanced analyzers...")
        try:
            self._zone_analysis = self.zone_analyzer.analyze_zone_patterns(self.historical)
            print(f"✅ Zone analysis: {len(self._zone_analysis.get('hot_zones', []))} hot zones identified")
        except Exception as e:
            print(f"⚠️ Zone analysis failed: {e}")
            self._zone_analysis = {}
        
        try:
            self._gap_analysis = self.gap_analyzer.analyze_gaps(self.historical)
            print(f"✅ Gap analysis: ideal range {self._gap_analysis.get('ideal_gap_range', 'N/A')}")
        except Exception as e:
            print(f"⚠️ Gap analysis failed: {e}")
            self._gap_analysis = {}
        
        try:
            self._trend_data = self.trend_analyzer.get_trending_numbers(self.historical)
            print(f"✅ Trend analysis: {len(self._trend_data.get('rising', []))} rising numbers")
        except Exception as e:
            print(f"⚠️ Trend analysis failed: {e}")
            self._trend_data = {}
        
        try:
            self._position_analysis = self.position_analyzer.analyze_positions(self.historical)
            print(f"✅ Position analysis: complete")
        except Exception as e:
            print(f"⚠️ Position analysis failed: {e}")
            self._position_analysis = {}
        
        # Initialize yearly pattern analyzer
        try:
            self._yearly_analysis = self.yearly_analyzer.analyze(
                self.historical, 
                self.draw_dates,
                self.lotto_types
            )
            years_count = self._yearly_analysis.get('summary', {}).get('total_years', 0)
            patterns_count = self._yearly_analysis.get('summary', {}).get('patterns_detected', 0)
            ml_trained = self._yearly_analysis.get('ml_trained', False)
            print(f"✅ Yearly analysis: {years_count} years analyzed, {patterns_count} patterns detected, ML trained: {ml_trained}")
        except Exception as e:
            print(f"⚠️ Yearly analysis failed: {e}")
            self._yearly_analysis = {}

    def generate_predictions(self, strategy: str = 'ensemble',
                             n_predictions: int = 3,
                             machine_draws: List[List[int]] = None) -> Dict[str, List[List[int]]]:
        """
        Generate predictions using specified strategy

        Returns: Dict with strategy as key and list of number sets
        """
        # Create deterministic seed from input data
        # Hash the historical data to create a stable seed
        data_str = str(sorted([tuple(sorted(d)) for d in self.historical]))
        seed = int(hashlib.md5((data_str + strategy).encode()).hexdigest()[:8], 16) % (2**31)
        random.seed(seed)
        np.random.seed(seed % (2**31))
        
        results = {}

        # Get historical patterns
        recent = self.historical[-50:] if len(self.historical) >= 50 else self.historical
        patterns = self._analyze_patterns(recent)

        if strategy == 'ensemble' or strategy == 'all':
            # Generate using multiple methods
            ml_pred = self._ml_based_prediction(patterns)
            genetic_pred = self._genetic_optimization(patterns)
            pattern_pred = self._pattern_based_prediction(patterns)
            
            # Intelligence engine prediction (if machine draws available)
            # Note: For ensemble, machine_draws should already be filtered in app.py to match historical
            intelligence_pred = None
            if machine_draws and len(machine_draws) > 0:
                # Check if lengths match (they should after filtering in app.py)
                if len(machine_draws) == len(self.historical):
                    try:
                        import sys
                        import os
                        # Add current directory to path for import
                        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
                        from intelligenceEngine import IntelligenceEngine
                        intel_engine = IntelligenceEngine(self.historical, machine_draws, seed=seed)
                        
                        # Enhanced: Get consensus from other strategies first to align intelligence
                        consensus_numbers = self._extract_consensus_numbers({
                            'ml': [ml_pred],
                            'genetic': [genetic_pred],
                            'pattern': [pattern_pred]
                        }, n_numbers=2)  # Get top 2 consensus numbers
                        
                        # Try to incorporate consensus into intelligence prediction
                        base_pred = intel_engine.predict('balanced')
                        
                        # If consensus numbers are in base prediction, keep them; otherwise try to align
                        if base_pred and len(base_pred) == 5:
                            # Check if consensus numbers are already in prediction
                            consensus_in_pred = [n for n in consensus_numbers if n in base_pred]
                            
                            # If we have consensus numbers not in prediction, try to incorporate them
                            if len(consensus_in_pred) < len(consensus_numbers):
                                # Try to replace some numbers with consensus numbers
                                missing_consensus = [n for n in consensus_numbers if n not in base_pred]
                                if missing_consensus:
                                    # Replace numbers with lowest scores with consensus numbers
                                    all_scores = {k: intel_engine.compute_unified_score(k) 
                                                for k in base_pred}
                                    sorted_by_score = sorted(all_scores.items(), key=lambda x: x[1])
                                    
                                    # Replace lowest scored numbers with consensus numbers
                                    intelligence_pred = base_pred.copy()
                                    for i, (num, _) in enumerate(sorted_by_score):
                                        if i < len(missing_consensus):
                                            idx = intelligence_pred.index(num)
                                            intelligence_pred[idx] = missing_consensus[i]
                                    intelligence_pred = sorted(intelligence_pred)
                                    print(f"Enhanced intelligence: Aligned with consensus {consensus_numbers}, prediction: {intelligence_pred}")
                                else:
                                    intelligence_pred = base_pred
                            else:
                                intelligence_pred = base_pred
                        else:
                            intelligence_pred = base_pred
                        
                        # Validate the prediction before adding
                        print(f"DEBUG: intelligence_pred = {intelligence_pred}, type = {type(intelligence_pred)}, len = {len(intelligence_pred) if intelligence_pred else 'N/A'}")
                        if intelligence_pred and len(intelligence_pred) == 5 and all(1 <= n <= 90 for n in intelligence_pred):
                            results['intelligence'] = [intelligence_pred]
                            print(f"Intelligence prediction generated and added to results: {intelligence_pred}")
                        else:
                            print(f"Warning: Intelligence prediction invalid: {intelligence_pred} (type: {type(intelligence_pred)}, length: {len(intelligence_pred) if intelligence_pred else 'N/A'})")
                            # Try to fix if it's close
                            if intelligence_pred and isinstance(intelligence_pred, list) and len(intelligence_pred) > 0:
                                # If we have some numbers, try to pad or trim
                                if len(intelligence_pred) < 5:
                                    print(f"  Attempting to pad from {len(intelligence_pred)} to 5 numbers")
                                elif len(intelligence_pred) > 5:
                                    print(f"  Attempting to trim from {len(intelligence_pred)} to 5 numbers")
                            # Don't add invalid predictions
                    except Exception as e:
                        # Fallback if intelligence engine fails
                        import traceback
                        error_msg = f"Intelligence engine failed: {str(e)}\n{traceback.format_exc()}"
                        print(error_msg)
                        # Don't add to results if it fails
                else:
                    print(f"Warning: Machine draws length ({len(machine_draws)}) doesn't match historical length ({len(self.historical)}). Skipping intelligence in ensemble.")

            results['ml'] = [ml_pred]
            results['genetic'] = [genetic_pred]
            results['pattern'] = [pattern_pred]
            
            # Ensemble includes intelligence if available
            ensemble_inputs = [ml_pred, genetic_pred, pattern_pred]
            if intelligence_pred:
                ensemble_inputs.append(intelligence_pred)
            results['ensemble'] = [self._ensemble_vote(ensemble_inputs)]

        elif strategy == 'ml':
            pred = self._ml_based_prediction(patterns)
            results['ml'] = [pred]

        elif strategy == 'genetic':
            pred = self._genetic_optimization(patterns)
            results['genetic'] = [pred]

        elif strategy == 'pattern':
            pred = self._pattern_based_prediction(patterns)
            results['pattern'] = [pred]
        
        elif strategy == 'intelligence':
            # Intelligence engine strategy (requires machine numbers)
            # Note: machine_draws should already be filtered to match historical length
            print(f"DEBUG: Intelligence strategy - historical length: {len(self.historical)}, machine_draws: {'present' if machine_draws else 'None'} ({len(machine_draws) if machine_draws else 0} entries)")
            if not machine_draws:
                print("ERROR: Intelligence strategy requires machine numbers but none were provided")
                # Don't raise - provide fallback instead
                # Use frequency-based fallback
                from collections import Counter
                all_numbers = []
                for draw in self.historical:
                    all_numbers.extend(draw)
                freq = Counter(all_numbers)
                top_5_fallback = sorted([n for n, _ in freq.most_common(5)])
                results['intelligence'] = [top_5_fallback]
                print(f"Using frequency-based fallback for intelligence: {top_5_fallback}")
                return results
            
            # Ensure lengths match (they should after filtering in app.py)
            if len(machine_draws) != len(self.historical):
                print(f"WARNING: Machine draws length ({len(machine_draws)}) doesn't match historical length ({len(self.historical)})")
                print(f"  This should have been filtered in app.py. Using frequency-based fallback.")
                # Don't raise - provide fallback instead
                from collections import Counter
                all_numbers = []
                for draw in self.historical:
                    all_numbers.extend(draw)
                freq = Counter(all_numbers)
                top_5_fallback = sorted([n for n, _ in freq.most_common(5)])
                results['intelligence'] = [top_5_fallback]
                print(f"Using frequency-based fallback for intelligence: {top_5_fallback}")
                return results
            
            try:
                import sys
                import os
                # Add current directory to path for import
                sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
                from intelligenceEngine import IntelligenceEngine
                intel_engine = IntelligenceEngine(self.historical, machine_draws, seed=seed)
                
                # Generate multiple persona tickets
                personas = ['balanced', 'structural_anchor', 'machine_memory_hunter', 
                           'cluster_rider', 'breakout_speculator']
                all_tickets = []
                for persona in personas:
                    try:
                        tickets = intel_engine.generate_persona_tickets(persona)
                        if tickets:
                            all_tickets.extend(tickets)
                    except Exception as e:
                        print(f"Warning: Persona {persona} failed: {e}")
                        continue
                
                # Score all tickets and return best
                if all_tickets:
                    scored = [(t, intel_engine.score_ticket(t)) for t in all_tickets]
                    scored.sort(key=lambda x: x[1], reverse=True)
                    # Return top prediction - check if scored has elements
                    if scored and len(scored) > 0 and len(scored[0]) > 0:
                        results['intelligence'] = [scored[0][0]]
                    else:
                        # Fallback if scored is empty
                        print(f"WARNING: scored list is empty, using fallback")
                        raise ValueError("No scored tickets available")
                else:
                    # Fallback: use balanced persona directly
                    try:
                        fallback_ticket = intel_engine.predict('balanced')
                        if fallback_ticket and len(fallback_ticket) == 5:
                            results['intelligence'] = [fallback_ticket]
                        else:
                            # Last resort: use top 5 by unified score
                            all_scores = {k: intel_engine.compute_unified_score(k) 
                                        for k in range(1, 91)}
                            top_5 = sorted(all_scores.items(), key=lambda x: x[1], reverse=True)[:5]
                            results['intelligence'] = [sorted([n for n, _ in top_5])]
                    except Exception as e:
                        print(f"Fallback prediction failed: {e}")
                        # Last resort: use top 5 by unified score
                        try:
                            all_scores = {k: intel_engine.compute_unified_score(k) 
                                        for k in range(1, 91)}
                            top_5 = sorted(all_scores.items(), key=lambda x: x[1], reverse=True)[:5]
                            results['intelligence'] = [sorted([n for n, _ in top_5])]
                        except Exception as e2:
                            print(f"Last resort failed: {e2}")
                            # Absolute last resort: return first 5 numbers (should never happen)
                            results['intelligence'] = [[1, 2, 3, 4, 5]]
            except Exception as e:
                import traceback
                error_msg = f"Intelligence engine failed: {str(e)}\n{traceback.format_exc()}"
                print(error_msg)
                # Try to provide a fallback prediction instead of empty array
                # Use top 5 numbers by frequency as absolute last resort
                try:
                    # Calculate simple frequency-based fallback
                    from collections import Counter
                    all_numbers = []
                    for draw in self.historical:
                        all_numbers.extend(draw)
                    freq = Counter(all_numbers)
                    top_5_fallback = sorted([n for n, _ in freq.most_common(5)])
                    results['intelligence'] = [top_5_fallback]
                    print(f"WARNING: Intelligence strategy failed, using frequency-based fallback: {top_5_fallback}")
                except Exception as e2:
                    print(f"Fallback generation also failed: {e2}")
                    # Absolute last resort: return a deterministic set
                    results['intelligence'] = [[1, 2, 3, 4, 5]]
                    print("WARNING: Intelligence strategy failed completely, using default fallback [1,2,3,4,5]")

        elif strategy == 'yearly':
            # Yearly Pattern Strategy - uses cross-year pattern analysis
            # Works well even with limited data at the start of a new year
            print("Generating yearly pattern-based predictions...")
            yearly_pred = None
            try:
                if self._yearly_analysis and 'predictions' in self._yearly_analysis:
                    yearly_preds = self._yearly_analysis['predictions']
                    print(f"DEBUG: yearly_preds = {yearly_preds}")
                    if yearly_preds and len(yearly_preds) > 0:
                        # Get the top prediction from yearly analysis
                        best_yearly = yearly_preds[0]
                        yearly_pred = best_yearly.get('numbers', [])
                        if yearly_pred and len(yearly_pred) == 5:
                            print(f"Yearly prediction: {yearly_pred} (confidence: {best_yearly.get('confidence', 0):.2%})")
                            
                            # Also add pattern summary
                            if 'summary' in self._yearly_analysis:
                                summary = self._yearly_analysis['summary']
                                print(f"  Years analyzed: {summary.get('total_years', 0)}")
                                print(f"  Patterns detected: {summary.get('patterns_detected', 0)}")
                        else:
                            print(f"Warning: Invalid yearly prediction: {yearly_pred}")
                            yearly_pred = None
                    else:
                        print("No yearly predictions in analysis, trying hybrid approach...")
                else:
                    print("Yearly analysis not available or empty...")
                
                # Fallback 1: hybrid approach with pattern boosting
                if not yearly_pred:
                    print("Using hybrid approach (pattern + yearly boost)...")
                    ml_pred = self._ml_based_prediction(patterns)
                    if ml_pred and len(ml_pred) == 5:
                        yearly_pred = self._boost_with_yearly_patterns(ml_pred)
                        print(f"Hybrid prediction: {yearly_pred}")
                
                # Fallback 2: pure pattern-based
                if not yearly_pred or len(yearly_pred) != 5:
                    print("Using pattern-based fallback...")
                    yearly_pred = self._pattern_based_prediction(patterns)
                    print(f"Pattern fallback prediction: {yearly_pred}")
                
                # Fallback 3: frequency-based
                if not yearly_pred or len(yearly_pred) != 5:
                    print("Using frequency-based fallback...")
                    from collections import Counter
                    all_numbers = []
                    for draw in self.historical:
                        all_numbers.extend(draw)
                    freq = Counter(all_numbers)
                    yearly_pred = sorted([n for n, _ in freq.most_common(5)])
                    print(f"Frequency fallback prediction: {yearly_pred}")
                
                # Final validation
                if yearly_pred and len(yearly_pred) == 5 and all(1 <= n <= 90 for n in yearly_pred):
                    results['yearly'] = [yearly_pred]
                else:
                    print(f"ERROR: All fallbacks failed, using default [10, 25, 45, 65, 80]")
                    results['yearly'] = [[10, 25, 45, 65, 80]]
                    
            except Exception as e:
                import traceback
                print(f"Yearly strategy failed with exception: {e}")
                print(traceback.format_exc())
                # Emergency fallback
                try:
                    pred = self._pattern_based_prediction(patterns)
                    if pred and len(pred) == 5:
                        results['yearly'] = [pred]
                    else:
                        results['yearly'] = [[10, 25, 45, 65, 80]]
                except:
                    results['yearly'] = [[10, 25, 45, 65, 80]]

        # Apply anti-pattern filtering to all predictions (with error handling)
        print("Applying anti-pattern filtering...")
        try:
            for method, pred_list in list(results.items()):  # Use list() to avoid dict modification during iteration
                if method in ['two_sure', 'three_direct', '_confidence']:
                    continue
                if pred_list and isinstance(pred_list, list):
                    filtered_preds = []
                    for pred in pred_list:
                        if pred and isinstance(pred, list) and len(pred) == 5:
                            try:
                                check = self.anti_pattern.check_patterns(pred)
                                if not check['is_valid']:
                                    print(f"  {method}: Fixing anti-pattern violations: {check['violations']}")
                                    # Get pool of good numbers from trend analysis
                                    good_pool = list(range(1, 91))
                                    if self._trend_data:
                                        rising = self._trend_data.get('rising', [])[:20]
                                        good_pool = rising + [n for n in good_pool if n not in rising]
                                    pred = self.anti_pattern.fix_prediction(pred, good_pool)
                            except Exception as e:
                                print(f"  Warning: Anti-pattern check failed for {method}: {e}")
                            filtered_preds.append(pred)
                        else:
                            filtered_preds.append(pred)
                    results[method] = filtered_preds
        except Exception as e:
            print(f"Warning: Anti-pattern filtering failed: {e}")
        
        # Extract "Two Sure" and "Three Direct" from all predictions
        # These are consensus numbers that appear across multiple strategies
        # Now enhanced with recency weighting
        if results:
            two_sure = self._extract_consensus_numbers(results, n_numbers=2)
            three_direct = self._extract_consensus_numbers(results, n_numbers=3)
            
            # Add to results as special features
            if two_sure:
                results['two_sure'] = [two_sure]
            if three_direct:
                results['three_direct'] = [three_direct]
            
            print(f"Two Sure (2 most likely): {two_sure}")
            print(f"Three Direct (3 most likely): {three_direct}")
        
        # Calculate confidence scores for each prediction (with error handling)
        print("Calculating confidence scores...")
        confidence_scores = {}
        try:
            for method, pred_list in list(results.items()):  # Use list() to avoid dict modification during iteration
                if method in ['two_sure', 'three_direct', '_confidence']:
                    continue
                if pred_list and isinstance(pred_list, list):
                    for pred in pred_list:
                        if pred and isinstance(pred, list) and len(pred) == 5:
                            try:
                                # Calculate strategy agreement (how many strategies predicted these numbers)
                                agreement = 0
                                total_strategies = len([k for k in results.keys() 
                                                      if k not in ['two_sure', 'three_direct', '_confidence']])
                                for other_method, other_preds in results.items():
                                    if other_method in ['two_sure', 'three_direct', '_confidence']:
                                        continue
                                    if other_preds and isinstance(other_preds, list):
                                        for other_pred in other_preds:
                                            if other_pred and isinstance(other_pred, list):
                                                overlap = len(set(pred) & set(other_pred))
                                                agreement += overlap / 5
                                
                                strategy_agreement = agreement / max(total_strategies, 1)
                                conf = self.confidence_scorer.calculate_confidence(
                                    pred, self.historical, strategy_agreement
                                )
                                confidence_scores[method] = conf
                                print(f"  {method}: confidence={conf['confidence']:.2f} ({conf['level']})")
                            except Exception as e:
                                print(f"  Warning: Confidence calculation failed for {method}: {e}")
        except Exception as e:
            print(f"Warning: Confidence scoring failed: {e}")
        
        # Store confidence with results
        results['_confidence'] = confidence_scores

        # Store for tracking
        self.prediction_history.append({
            'timestamp': pd.Timestamp.now(),
            'strategy': strategy,
            'predictions': results,
            'confidence': confidence_scores
        })

        print(f"DEBUG: Returning results with keys: {list(results.keys())}")
        return results

    def _analyze_patterns(self, recent_draws: List[List[int]]) -> Dict:
        """Analyze patterns in recent draws"""
        if not recent_draws:
            return {}

        sums = [sum(draw) for draw in recent_draws]
        evens = [sum(1 for n in draw if n % 2 == 0) for draw in recent_draws]
        highs = [sum(1 for n in draw if n > 45) for draw in recent_draws]

        # Calculate common patterns
        even_mode = Counter(evens).most_common(1)[0][0]
        high_mode = Counter(highs).most_common(1)[0][0]

        # Calculate number frequencies
        freq = Counter()
        for draw in recent_draws[-20:]:  # Last 20 draws weighted more
            for num in draw:
                freq[num] += 1

        hot_numbers = [num for num, _ in freq.most_common(15)]

        # Calculate skip cycles
        skips = {}
        for num in range(1, 91):
            skips[num] = 0
            for i in range(len(recent_draws) - 1, -1, -1):
                if num in recent_draws[i]:
                    skips[num] = len(recent_draws) - i - 1
                    break

        cold_numbers = sorted(skips.items(), key=lambda x: x[1], reverse=True)[:15]
        cold_numbers = [num for num, _ in cold_numbers]

        return {
            'sum_mean': np.mean(sums),
            'sum_std': np.std(sums),
            'sum_range': (int(np.percentile(sums, 25)), int(np.percentile(sums, 75))),
            'even_mode': even_mode,
            'high_mode': high_mode,
            'hot_numbers': hot_numbers,
            'cold_numbers': cold_numbers,
            'skips': skips
        }

    def _ml_based_prediction(self, patterns: Dict) -> List[int]:
        """Generate prediction using ML - deterministic selection"""
        # Get probability distribution from ML
        probs = self.ml_predictor.predict_proba(self.historical)

        # Deterministic selection: Use top probabilities with deterministic tie-breaking
        # Sort by probability, then by number for deterministic ordering
        sorted_nums = sorted(probs.items(), key=lambda x: (x[1], -x[0]), reverse=True)
        
        # Select top 5 numbers deterministically
        # Use a mix: top 3 highest probability + 2 from next tier for diversity
        selected = []
        
        # Top 3 highest probability
        for num, prob in sorted_nums[:3]:
            selected.append(num)
        
        # Next 2 from positions 4-15 for diversity (avoid all top numbers)
        for num, prob in sorted_nums[3:15]:
            if num not in selected:
                selected.append(num)
                if len(selected) >= 5:
                    break
        
        # Fill if needed (shouldn't happen, but safety check)
        if len(selected) < 5:
            for num, prob in sorted_nums:
                if num not in selected:
                    selected.append(num)
                    if len(selected) >= 5:
                        break

        return sorted(selected)

    def _genetic_optimization(self, patterns: Dict) -> List[int]:
        """Generate prediction using genetic optimization - distinct from ML"""
        # Create pattern-based probabilities (NOT ML-based) for differentiation
        probs = {}
        
        # Base probability from pattern analysis
        hot_weight = 0.4
        cold_weight = 0.3
        due_weight = 0.2
        frequency_weight = 0.1
        
        # Calculate frequency from recent draws
        freq = Counter()
        for draw in self.historical[-30:]:  # Last 30 draws
            for num in draw:
                freq[num] += 1
        
        max_freq = max(freq.values()) if freq else 1
        
        # Build probability distribution from patterns
        for num in range(1, 91):
            score = 0.01  # Base score
            
            # Hot numbers boost
            if num in patterns.get('hot_numbers', [])[:10]:
                score += hot_weight
            
            # Cold numbers boost (if very cold)
            if num in patterns.get('cold_numbers', [])[:5]:
                skip = patterns.get('skips', {}).get(num, 0)
                if skip > 20:
                    score += cold_weight * (skip / 30)  # More cold = higher boost
            
            # Due numbers (around average skip)
            avg_skip = np.mean(list(patterns.get('skips', {}).values())) if patterns.get('skips') else 10
            skip = patterns.get('skips', {}).get(num, 0)
            if 0.8 * avg_skip <= skip <= 1.2 * avg_skip:
                score += due_weight
            
            # Frequency boost
            score += frequency_weight * (freq.get(num, 0) / max_freq)
            
            probs[num] = score
        
        # Normalize
        total = sum(probs.values())
        if total > 0:
            probs = {k: v / total for k, v in probs.items()}
        else:
            # Fallback: uniform distribution
            probs = {k: 1/90 for k in range(1, 91)}

        # Set constraints for genetic algorithm
        constraints = {
            'target_sum_range': patterns['sum_range'],
            'even_odd_target': [2, 3],
            'high_low_target': [2, 3]
        }

        # Run genetic optimization (uses its own seed from generate_predictions)
        return self.genetic_optimizer.evolve_solution(probs, constraints)

    def _pattern_based_prediction(self, patterns: Dict) -> List[int]:
        """Generate prediction using pattern matching - deterministic"""
        # Create candidate pool with mix of hot, cold, and due numbers
        hot_pool = patterns.get('hot_numbers', [])[:10]
        cold_pool = [n for n in patterns.get('cold_numbers', []) 
                    if patterns.get('skips', {}).get(n, 0) > 15][:10]

        # Numbers due for appearance (skip around average skip)
        skips = patterns.get('skips', {})
        avg_skip = np.mean(list(skips.values())) if skips else 10
        due_pool = [n for n in range(1, 91)
                    if 0.8 * avg_skip <= skips.get(n, 0) <= 1.2 * avg_skip][:10]

        candidate_pool = list(set(hot_pool + cold_pool + due_pool))

        # Ensure we have enough candidates
        if len(candidate_pool) < 15:
            # Deterministic selection: use numbers with highest pattern scores
            all_candidates = list(range(1, 91))
            for num in candidate_pool:
                if num in all_candidates:
                    all_candidates.remove(num)
            # Add deterministically based on pattern scores
            candidate_scores = []
            for num in all_candidates[:20]:  # Check first 20 not in pool
                score = self._score_pattern_candidate([num], patterns)
                candidate_scores.append((num, score))
            candidate_scores.sort(key=lambda x: x[1], reverse=True)
            candidate_pool.extend([num for num, _ in candidate_scores[:15 - len(candidate_pool)]])

        # Deterministic selection: Score all combinations and pick best
        # Use a more efficient approach: select top candidates deterministically
        best_candidate = None
        best_score = -float('inf')

        # Score each candidate number individually
        candidate_scores = {}
        for num in candidate_pool:
            candidate_scores[num] = self._score_pattern_candidate([num], patterns)
        
        # Sort by score
        sorted_candidates = sorted(candidate_scores.items(), key=lambda x: x[1], reverse=True)
        
        # Build the best combination deterministically
        selected = []
        for num, score in sorted_candidates:
            if len(selected) < 5:
                # Check if adding this number improves the combination
                test_combination = selected + [num]
                if len(test_combination) <= 5:
                    test_score = self._score_pattern_candidate(test_combination, patterns)
                    if test_score > best_score or len(selected) < 5:
                        selected.append(num)
                        best_score = test_score
                        best_candidate = selected.copy()
        
        # Ensure we have 5 numbers
        if len(selected) < 5:
            remaining = [n for n in range(1, 91) if n not in selected]
            # Select deterministically from remaining based on pattern scores
            remaining_scores = [(n, self._score_pattern_candidate([n], patterns)) 
                              for n in remaining]
            remaining_scores.sort(key=lambda x: x[1], reverse=True)
            selected.extend([n for n, _ in remaining_scores[:5 - len(selected)]])

        return sorted(selected) if selected else []

    def _score_pattern_candidate(self, candidate: List[int],
                                 patterns: Dict) -> float:
        """Score a candidate based on pattern matching"""
        score = 0

        # Hot numbers bonus
        hot_numbers = patterns.get('hot_numbers', [])
        if hot_numbers:
            hot_bonus = sum(1 for n in candidate if n in hot_numbers[:10])
            score += hot_bonus * 2

        # Cold numbers bonus (if very cold)
        cold_numbers = patterns.get('cold_numbers', [])
        skips = patterns.get('skips', {})
        if cold_numbers and skips:
            cold_bonus = sum(1 for n in candidate
                             if n in cold_numbers[:5] and skips.get(n, 0) > 20)
            score += cold_bonus * 3

        # Sum constraint
        total = sum(candidate)
        sum_range = patterns.get('sum_range', (0, 1000))
        if sum_range[0] <= total <= sum_range[1]:
            score += 5

        # Even/Odd balance
        evens = sum(1 for n in candidate if n % 2 == 0)
        if evens in [2, 3]:
            score += 3

        # High/Low balance
        highs = sum(1 for n in candidate if n > 45)
        if highs in [2, 3]:
            score += 3

        # No consecutive numbers
        sorted_cand = sorted(candidate)
        if len(sorted_cand) >= 2:
            # Use len(sorted_cand) - 1 instead of hardcoded 4 to avoid index errors
            consecutive_penalty = sum(1 for i in range(len(sorted_cand) - 1)
                                      if sorted_cand[i + 1] - sorted_cand[i] == 1)
            score -= consecutive_penalty * 2

        return score

    def _ensemble_vote(self, predictions: List[List[int]]) -> List[int]:
        """Combine multiple predictions using enhanced consensus-based voting"""
        if not predictions:
            return []

        # Enhanced voting: Prioritize numbers that appear in multiple strategies
        # This addresses the issue where consensus numbers (like "2") should be prioritized
        votes = Counter()
        strategy_weights = [1.0, 1.2, 1.1, 1.3]  # ML, Genetic, Pattern, Intelligence
        
        # Count how many strategies predict each number
        strategy_count = Counter()
        for pred in predictions:
            for num in pred:
                strategy_count[num] += 1
        
        # Enhanced voting: Base weight + consensus bonus
        for i, pred in enumerate(predictions):
            weight = strategy_weights[i] if i < len(strategy_weights) else 1.0
            for num in pred:
                # Base vote from strategy weight
                base_vote = weight
                # Consensus bonus: numbers predicted by multiple strategies get extra weight
                consensus_bonus = strategy_count[num] * 0.5  # 0.5 per additional strategy
                votes[num] += base_vote + consensus_bonus

        # Prioritize numbers with highest consensus (appear in multiple strategies)
        # Sort by: 1) number of strategies predicting it, 2) total weighted votes
        number_scores = []
        for num in votes:
            consensus_score = strategy_count[num]
            vote_score = votes[num]
            # Combined score: consensus is more important
            combined_score = (consensus_score * 10) + vote_score
            number_scores.append((num, combined_score, consensus_score, vote_score))
        
        # Sort by combined score (consensus first, then votes)
        number_scores.sort(key=lambda x: (x[1], x[2], x[3]), reverse=True)

        # Select top 5, prioritizing consensus numbers
        selected = []
        for num, _, consensus, _ in number_scores:
            if len(selected) < 5:
                selected.append(num)
            else:
                break

        # Ensure we have 5 numbers
        if len(selected) < 5:
            remaining = [n for n in range(1, 91) if n not in selected]
            remaining_scores = [(n, votes.get(n, 0)) for n in remaining]
            remaining_scores.sort(key=lambda x: x[1], reverse=True)
            selected.extend([n for n, _ in remaining_scores[:5 - len(selected)]])

        return sorted(selected)
    
    def _boost_with_yearly_patterns(self, base_prediction: List[int]) -> List[int]:
        """
        Boost a base prediction with yearly pattern data.
        Replaces some numbers with yearly pattern candidates.
        """
        if not self._yearly_analysis or 'patterns' not in self._yearly_analysis:
            return base_prediction
        
        patterns = self._yearly_analysis['patterns']
        if not patterns:
            return base_prediction
        
        # Collect high-confidence pattern numbers
        pattern_candidates = Counter()
        for pattern in patterns:
            confidence = pattern.get('confidence', 0)
            for num in pattern.get('numbers', []):
                pattern_candidates[num] += confidence
        
        if not pattern_candidates:
            return base_prediction
        
        # Get top pattern numbers
        top_pattern_nums = [n for n, _ in pattern_candidates.most_common(10)]
        
        # Boost prediction: replace 2 numbers with pattern candidates
        boosted = base_prediction.copy()
        replacements = 0
        
        for num in top_pattern_nums:
            if num not in boosted and replacements < 2:
                # Replace the number with lowest pattern score
                min_score_idx = 0
                min_score = pattern_candidates.get(boosted[0], 0)
                for i, n in enumerate(boosted):
                    score = pattern_candidates.get(n, 0)
                    if score < min_score:
                        min_score = score
                        min_score_idx = i
                
                boosted[min_score_idx] = num
                replacements += 1
        
        return sorted(boosted)
    
    def _extract_consensus_numbers(self, predictions: Dict[str, List[List[int]]], 
                                   n_numbers: int = 2) -> List[int]:
        """
        Extract the n most likely numbers based on consensus across all strategies.
        Enhanced with recency weighting and trend analysis.
        This implements "Two Sure" (n=2) and "Three Direct" (n=3) features.
        
        Args:
            predictions: Dict of strategy -> list of predictions
            n_numbers: Number of consensus numbers to extract (2 for Two Sure, 3 for Three Direct)
        
        Returns:
            List of n_numbers most likely numbers based on consensus
        """
        if not predictions:
            return []
        
        # Count how many strategies predict each number
        strategy_count = Counter()
        strategy_weights = {'ml': 1.0, 'genetic': 1.2, 'pattern': 1.1, 'intelligence': 1.3, 'ensemble': 1.0}
        
        for strategy, pred_list in predictions.items():
            # Skip special features like two_sure, three_direct
            if strategy in ['two_sure', 'three_direct']:
                continue
            weight = strategy_weights.get(strategy, 1.0)
            for pred in pred_list:
                if pred and isinstance(pred, list):
                    for num in pred:
                        if isinstance(num, (int, float)) and 1 <= num <= 90:
                            strategy_count[num] += weight
        
        # Get recency boost from trend data
        recency_boost = {}
        if self._trend_data:
            rising_nums = set(self._trend_data.get('rising', [])[:10])
            accelerating_nums = set(self._trend_data.get('accelerating', [])[:10])
            for num in range(1, 91):
                boost = 0
                if num in rising_nums:
                    boost += 0.3
                if num in accelerating_nums:
                    boost += 0.2
                recency_boost[num] = boost
        
        # Get numbers sorted by consensus (how many strategies predict them)
        # Then by weighted count + recency boost
        number_scores = []
        for num, count in strategy_count.items():
            # Count how many different strategies predicted this number
            strategy_names = set()
            for strategy, pred_list in predictions.items():
                if strategy in ['two_sure', 'three_direct']:
                    continue
                for pred in pred_list:
                    if pred and isinstance(pred, list) and num in pred:
                        strategy_names.add(strategy)
            
            consensus_count = len(strategy_names)
            # Apply recency boost
            boost = recency_boost.get(num, 0)
            # Score: consensus is primary, weighted count + boost is secondary
            score = (consensus_count * 100) + count + (boost * 10)
            number_scores.append((num, score, consensus_count, count, boost))
        
        # Sort by score (consensus first)
        number_scores.sort(key=lambda x: (x[1], x[2], x[3]), reverse=True)
        
        # Extract top n_numbers
        result = [num for num, _, _, _, _ in number_scores[:n_numbers]]
        
        # Ensure we have n_numbers (fill with highest weighted if needed)
        if len(result) < n_numbers:
            remaining = [n for n, _, _, _, _ in number_scores[len(result):]]
            result.extend(remaining[:n_numbers - len(result)])
        
        return sorted(result)

    def evaluate_prediction(self, prediction: List[int],
                            actual: List[int]) -> Dict:
        """Evaluate prediction against actual draw"""
        matches = len(set(prediction) & set(actual))

        # Calculate expected matches for random selection
        expected_random = 5 * (5 / 90)  # ~0.278

        # Calculate statistical significance
        z_score = (matches - expected_random) / np.sqrt(expected_random * (1 - 5 / 90))

        return {
            'matches': matches,
            'expected_random': expected_random,
            'z_score': z_score,
            'significant': abs(z_score) > 1.96,  # 95% confidence
            'prediction': prediction,
            'actual': actual
        }