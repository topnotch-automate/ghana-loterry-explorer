#!/usr/bin/env python3
"""
Python Microservice for Lotto Oracle Predictions
Flask API wrapper around EnhancedLottoOracle
"""

import os
import json
import sys
from flask import Flask, request, jsonify
from flask_cors import CORS
from typing import List, Dict, Any
import warnings
import numpy as np

warnings.filterwarnings('ignore')

# Import the oracle system
from lottOracleV2 import EnhancedLottoOracle


def make_json_serializable(obj: Any) -> Any:
    """Convert numpy types and other non-JSON types to JSON-serializable types"""
    # Handle numpy types
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, (np.bool_, bool)):
        return bool(obj)
    # Handle Python native types
    elif isinstance(obj, bool):
        return obj
    elif isinstance(obj, dict):
        return {k: make_json_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [make_json_serializable(item) for item in obj]
    else:
        # Try to convert if it's a numpy scalar
        try:
            if hasattr(obj, 'item'):
                return obj.item()
        except (ValueError, AttributeError):
            pass
        return obj

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests from Node.js backend

# Global oracle instance (initialized on first request)
oracle_instance = None
historical_draws_cache = None
draw_dates_cache = None  # Cache for draw dates (for yearly analysis)
oracle_initializing = False  # Lock to prevent concurrent initialization


def initialize_oracle(draws: List[List[int]], draw_dates: List[str] = None, lotto_types: List[str] = None) -> EnhancedLottoOracle:
    """Initialize or reinitialize the oracle with new data"""
    global oracle_instance, oracle_initializing, draw_dates_cache
    
    # Prevent concurrent initialization
    if oracle_initializing:
        print("WARNING: Oracle is already initializing, waiting...")
        import time
        max_wait = 60  # Wait up to 60 seconds
        waited = 0
        while oracle_initializing and waited < max_wait:
            time.sleep(1)
            waited += 1
        if oracle_instance is not None:
            return oracle_instance
    
    try:
        oracle_initializing = True
        print(f"Initializing oracle with {len(draws)} draws...")
        draw_dates_cache = draw_dates
        oracle_instance = EnhancedLottoOracle(draws, draw_dates, lotto_types)
        print(f"Oracle initialized successfully")
        return oracle_instance
    except Exception as e:
        print(f"ERROR initializing oracle: {e}")
        import traceback
        traceback.print_exc()
        # Don't leave oracle_instance as None - try to create a minimal instance
        oracle_instance = None
        raise
    finally:
        oracle_initializing = False


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'oracle_initialized': bool(oracle_instance is not None)
    })


@app.route('/predict', methods=['POST'])
def predict():
    """
    Generate predictions
    
    Request body:
    {
        "draws": [[1, 2, 3, 4, 5], ...],  # Historical draws (winning numbers only)
        "machine_draws": [[6, 7, 8, 9, 10], ...],  # Machine numbers (optional, required for intelligence strategy)
        "draw_dates": ["2024-01-15", ...],  # Draw dates (optional, used for yearly strategy)
        "strategy": "ensemble",  # Options: "ensemble", "ml", "genetic", "pattern", "intelligence", "yearly"
        "n_predictions": 3
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        draws = data.get('draws', [])
        machine_draws = data.get('machine_draws', [])
        draw_dates = data.get('draw_dates', [])  # Draw dates for yearly analysis
        lotto_types = data.get('lotto_types', [])  # Lotto types for yearly analysis
        strategy = data.get('strategy', 'ensemble')
        n_predictions = data.get('n_predictions', 3)
        
        # Store original count for logging (before filtering)
        original_draw_count = len(draws)
        
        # Validate draws format
        if not draws or not isinstance(draws, list):
            return jsonify({'error': 'Invalid draws format. Expected list of lists'}), 400
        
        # Validate and normalize winning draws first - ensure all are exactly 5 numbers
        valid_draws = []
        for i, win_draw in enumerate(draws):
            if not win_draw or not isinstance(win_draw, list):
                print(f"Warning: Draw {i} has invalid winning numbers (not a list). Skipping.")
                continue
            if len(win_draw) != 5:
                print(f"Warning: Draw {i} has {len(win_draw)} winning numbers (expected 5). Skipping.")
                continue
            if not all(isinstance(n, int) and 1 <= n <= 90 for n in win_draw):
                print(f"Warning: Draw {i} has winning numbers out of range. Skipping.")
                continue
            valid_draws.append(win_draw)
        
        if len(valid_draws) < 50:
            return jsonify({'error': f'Insufficient valid draws. Need at least 50, got {len(valid_draws)}'}), 400
        
        draws = valid_draws
        
        # Handle machine draws - fill missing with zeros or use winning numbers
        # Don't throw errors, just normalize the data
        if not machine_draws or len(machine_draws) == 0:
            # No machine draws provided - fill with zeros (exactly 5 zeros per draw)
            machine_draws = [[0, 0, 0, 0, 0] for _ in draws]
            print(f"Warning: No machine_draws provided. Filling with zeros for {len(draws)} draws.")
        elif len(machine_draws) != len(draws):
            # Length mismatch - pad or truncate to match draws length
            if len(machine_draws) < len(draws):
                # Pad with zeros for missing entries (exactly 5 zeros per entry)
                missing_count = len(draws) - len(machine_draws)
                machine_draws.extend([[0, 0, 0, 0, 0] for _ in range(missing_count)])
                print(f"Warning: machine_draws length ({len(machine_draws) - missing_count}) < draws length ({len(draws)}). Padded {missing_count} entries with zeros.")
            else:
                # Truncate to match draws length
                machine_draws = machine_draws[:len(draws)]
                print(f"Warning: machine_draws length ({len(machine_draws)}) > draws length ({len(draws)}). Truncated to match.")
        
        # Normalize each machine draw - ensure exactly 5 numbers per draw
        normalized_machine_draws = []
        for i, mach_draw in enumerate(machine_draws):
            if not mach_draw or not isinstance(mach_draw, list):
                # Invalid machine draw - use zeros (exactly 5 zeros)
                normalized_machine_draws.append([0, 0, 0, 0, 0])
                print(f"Warning: Draw {i} has invalid machine numbers (not a list). Using zeros.")
            elif len(mach_draw) != 5:
                # Wrong length - normalize to exactly 5
                if len(mach_draw) > 5:
                    print(f"Warning: Draw {i} has {len(mach_draw)} machine numbers, truncating to 5.")
                    normalized_machine_draws.append(mach_draw[:5])
                else:  # len(mach_draw) < 5
                    print(f"Warning: Draw {i} has {len(mach_draw)} machine numbers, padding with zeros to 5.")
                    normalized = mach_draw + [0] * (5 - len(mach_draw))
                    normalized_machine_draws.append(normalized)
            elif not all(isinstance(n, int) and 0 <= n <= 90 for n in mach_draw):
                # Some numbers out of range - use zeros (exactly 5 zeros)
                normalized_machine_draws.append([0, 0, 0, 0, 0])
                print(f"Warning: Draw {i} has machine numbers out of range. Using zeros.")
            else:
                # Valid machine draw - already exactly 5 numbers
                normalized_machine_draws.append(mach_draw)
        
        # Final validation: ensure all normalized machine draws are exactly 5 numbers
        for i, mach_draw in enumerate(normalized_machine_draws):
            if len(mach_draw) != 5:
                print(f"ERROR: Normalized machine draw {i} has {len(mach_draw)} numbers! This should never happen. Fixing...")
                if len(mach_draw) > 5:
                    normalized_machine_draws[i] = mach_draw[:5]
                else:
                    normalized_machine_draws[i] = mach_draw + [0] * (5 - len(mach_draw))
        
        machine_draws = normalized_machine_draws
        
        # Filter machine numbers for strategies that need them (intelligence and ensemble)
        # Do this BEFORE checking minimum requirements, as filtering may reduce the count
        # For ensemble, we filter so intelligence can work; for intelligence, we require it
        if strategy in ['intelligence', 'ensemble'] and machine_draws:
            # Filter to only include draws with valid machine numbers (length == 5)
            filtered_draws = []
            filtered_machines = []
            for i, (win_draw, mach_draw) in enumerate(zip(draws, machine_draws)):
                # Check if machine draw is valid (not all zeros, length 5, all numbers in range 1-90)
                if mach_draw and len(mach_draw) == 5 and all(isinstance(n, int) and 1 <= n <= 90 for n in mach_draw) and not all(n == 0 for n in mach_draw):
                    filtered_draws.append(win_draw)
                    filtered_machines.append(mach_draw)
            
            if strategy == 'intelligence':
                # Intelligence requires at least 50 valid draws
                if len(filtered_draws) < 50:
                    return jsonify({
                        'error': 'Insufficient data',
                        'message': f'Need at least 50 draws with valid machine numbers. Found {len(filtered_draws)} valid draws out of {len(draws)} total.',
                        'valid_draws': len(filtered_draws),
                        'total_draws': len(draws)
                    }), 400
            elif strategy == 'ensemble':
                # Ensemble can work with fewer, but log if we filtered
                if len(filtered_draws) < len(draws):
                    print(f"Ensemble strategy: Filtered to {len(filtered_draws)} draws with valid machine numbers (from {original_draw_count} total) for intelligence engine")
            
            # Use filtered data for intelligence/ensemble
            if len(filtered_draws) > 0:
                draws = filtered_draws
                machine_draws = filtered_machines
            else:
                # No valid machine numbers - set to empty so intelligence won't be used
                machine_draws = []
                print(f"Warning: No draws with valid machine numbers. Intelligence engine will be skipped.")
        
        elif strategy == 'intelligence' and not machine_draws:
            return jsonify({
                'error': 'Machine numbers required',
                'message': 'Intelligence strategy requires machine_draws in request body'
            }), 400
        
        # Check minimum data requirement AFTER filtering (if filtering occurred)
        min_required = 60 if strategy not in ['intelligence', 'ensemble'] else 50
        if len(draws) < min_required:
            return jsonify({
                'error': 'Insufficient data',
                'message': f'Need at least {min_required} draws. Got {len(draws)} after filtering.',
                'minimum_required': min_required
            }), 400
        
        # Initialize or update oracle if data changed
        global historical_draws_cache, oracle_instance, draw_dates_cache
        # Use a more robust comparison (convert to tuples for comparison)
        draws_tuple = tuple(tuple(sorted(d)) for d in draws)
        dates_changed = draw_dates and draw_dates_cache != draw_dates
        if historical_draws_cache != draws_tuple or oracle_instance is None or (strategy == 'yearly' and dates_changed):
            historical_draws_cache = draws_tuple
            try:
                # Pass draw_dates and lotto_types for yearly strategy
                initialize_oracle(
                    draws, 
                    draw_dates if strategy == 'yearly' else None,
                    lotto_types if strategy == 'yearly' else None
                )
            except Exception as e:
                print(f"ERROR: Failed to initialize oracle: {e}")
                return jsonify({
                    'error': 'Oracle initialization failed',
                    'message': str(e)
                }), 500
        
        # Double-check oracle is initialized
        if oracle_instance is None:
            return jsonify({
                'error': 'Oracle not initialized',
                'message': 'The prediction oracle is not available. Please try again.'
            }), 500
        
        # Generate predictions (now deterministic based on data + strategy)
        print(f"DEBUG: About to call generate_predictions with strategy={strategy}, draws={len(draws)}, machine_draws={'present' if machine_draws else 'None'} ({len(machine_draws) if machine_draws else 0} entries)")
        try:
            predictions = oracle_instance.generate_predictions(
                strategy=strategy,
                n_predictions=n_predictions,
                machine_draws=machine_draws if machine_draws else None
            )
        except Exception as e:
            print(f"ERROR: generate_predictions failed: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({
                'error': 'Prediction generation failed',
                'message': str(e)
            }), 500
        
        print(f"DEBUG: generate_predictions returned: {predictions}")
        print(f"DEBUG: predictions.keys() = {list(predictions.keys())}")
        if 'intelligence' in predictions:
            print(f"DEBUG: intelligence in predictions: {predictions['intelligence']}")
        else:
            print(f"DEBUG: intelligence NOT in predictions")
        
        # Convert predictions to JSON-serializable format
        result = {}
        
        # CRITICAL FIX: If strategy is intelligence/yearly and predictions dict is empty or missing the key,
        # provide a fallback immediately
        if strategy in ['intelligence', 'yearly']:
            if not predictions or strategy not in predictions:
                print(f"CRITICAL: {strategy} strategy but predictions dict is empty or missing {strategy} key!")
                print(f"  predictions = {predictions}")
                print(f"  predictions.keys() = {list(predictions.keys()) if predictions else 'N/A'}")
                # Provide immediate fallback
                try:
                    from collections import Counter
                    all_numbers = []
                    for draw in draws:
                        all_numbers.extend(draw)
                    freq = Counter(all_numbers)
                    top_5_fallback = sorted([n for n, _ in freq.most_common(5)])
                    print(f"  Providing immediate fallback: {top_5_fallback}")
                    predictions[strategy] = [top_5_fallback]
                except Exception as e:
                    print(f"  Fallback generation failed: {e}, using default [1,2,3,4,5]")
                    predictions[strategy] = [[1, 2, 3, 4, 5]]
        
        for method, preds in predictions.items():
            # Skip internal keys (like _confidence)
            if method.startswith('_'):
                continue
            
            # Special handling for two_sure and three_direct (not 5-number predictions)
            if method in ['two_sure', 'three_direct']:
                if preds and len(preds) > 0 and isinstance(preds[0], list):
                    # These are special features - just store the numbers
                    result[method] = {
                        'numbers': make_json_serializable(preds[0]),
                        'count': len(preds[0]),
                        'type': 'two_sure' if method == 'two_sure' else 'three_direct'
                    }
                continue
            
            # Special handling for intelligence and yearly strategies - provide fallback if empty
            if not preds or len(preds) == 0:
                if method in ['intelligence', 'yearly']:
                    print(f"ERROR: {method} strategy returned no predictions (preds: {preds})")
                    print(f"  This is a critical error - {method} strategy must return predictions")
                    # Provide a fallback prediction based on frequency
                    try:
                        from collections import Counter
                        all_numbers = []
                        for draw in draws:
                            all_numbers.extend(draw)
                        freq = Counter(all_numbers)
                        top_5_fallback = sorted([n for n, _ in freq.most_common(5)])
                        print(f"  Using frequency-based fallback: {top_5_fallback}")
                        preds = [top_5_fallback]  # Replace empty with fallback
                    except Exception as e:
                        print(f"  Fallback generation failed: {e}, using default [1,2,3,4,5]")
                        preds = [[1, 2, 3, 4, 5]]  # Absolute fallback
                else:
                    # Skip empty predictions for other methods
                    print(f"Warning: {method} strategy returned no predictions (preds: {preds})")
                    continue
            
            result[method] = []
            for pred in preds:
                # Handle None values
                if pred is None:
                    print(f"Warning: {method} returned None prediction")
                    continue
                # Ensure pred is a list
                if not isinstance(pred, list):
                    print(f"Warning: {method} returned non-list prediction: {type(pred)}, value: {pred}")
                    continue
                if len(pred) != 5:
                    print(f"Warning: {method} returned invalid prediction length {len(pred)}: {pred}")
                    continue
                # Validate numbers are in range
                if not all(isinstance(n, (int, float)) and 1 <= n <= 90 for n in pred):
                    print(f"Warning: {method} returned prediction with invalid numbers: {pred}")
                    continue
                result[method].append({
                    'numbers': make_json_serializable(pred),
                    'sum': int(sum(pred)),
                    'evens': int(sum(1 for n in pred if n % 2 == 0)),
                    'highs': int(sum(1 for n in pred if n > 45))
                })
        
        # Debug: Log what we're returning
        print(f"Returning predictions with methods: {list(result.keys())}")
        for method, preds in result.items():
            # Handle two_sure and three_direct which are stored as dicts, not lists
            if method in ['two_sure', 'three_direct']:
                print(f"  {method}: {preds.get('numbers', 'N/A')}")
            elif isinstance(preds, list):
                print(f"  {method}: {len(preds)} prediction(s)")
                if preds and len(preds) > 0 and isinstance(preds[0], dict):
                    print(f"    First prediction: {preds[0].get('numbers', 'N/A')}")
        
        # Also log what was in the original predictions dict
        print(f"Original predictions dict keys: {list(predictions.keys())}")
        if 'intelligence' in predictions:
            print(f"  intelligence in predictions: {predictions['intelligence']}")
        else:
            print(f"  intelligence NOT in predictions dict")
        
        # Ensure we have at least one prediction method
        if not result:
            return jsonify({
                'error': 'No predictions generated',
                'message': f'Strategy "{strategy}" returned no valid predictions. Please try another strategy.',
                'strategy': strategy
            }), 500
        
        # Get regime change info if available
        regime_info = None
        if oracle_instance.regime_history:
            regime_info = oracle_instance.regime_history[-1]
            # Convert all values to JSON-serializable types
            regime_info = make_json_serializable(regime_info)
        
        # Extract confidence scores from predictions (stored under _confidence key)
        confidence_info = None
        if '_confidence' in predictions:
            confidence_info = make_json_serializable(predictions['_confidence'])
            # Remove from result dict (already extracted)
            if '_confidence' in result:
                del result['_confidence']
        
        # Get trend information if available
        trend_info = None
        if hasattr(oracle_instance, '_trend_data') and oracle_instance._trend_data:
            trend_info = {
                'rising': oracle_instance._trend_data.get('rising', [])[:10],
                'falling': oracle_instance._trend_data.get('falling', [])[:10],
                'accelerating': oracle_instance._trend_data.get('accelerating', [])[:5]
            }
        
        # Ensure all values in response are JSON-serializable
        response_data = {
            'success': True,
            'predictions': make_json_serializable(result),
            'strategy': str(strategy),
            'regime_change': regime_info,
            'confidence': confidence_info,
            'trend_analysis': trend_info,
            'data_points_used': int(len(draws))
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        return jsonify({
            'error': 'Prediction failed',
            'message': str(e)
        }), 500


@app.route('/analyze', methods=['POST'])
def analyze():
    """
    Analyze patterns without generating predictions
    
    Request body:
    {
        "draws": [[1, 2, 3, 4, 5], ...]
    }
    """
    try:
        data = request.get_json()
        draws = data.get('draws', [])
        
        if not draws or len(draws) < 50:
            return jsonify({
                'error': 'Insufficient data',
                'minimum_required': 50
            }), 400
        
        # Initialize oracle
        global historical_draws_cache
        if historical_draws_cache != draws:
            historical_draws_cache = draws
            initialize_oracle(draws)
        
        # Get pattern analysis
        recent = draws[-50:] if len(draws) >= 50 else draws
        patterns = oracle_instance._analyze_patterns(recent)
        
        # Get regime change detection
        regime = oracle_instance.pattern_detector.detect_regime_change(draws[-100:]) if len(draws) >= 100 else None
        
        # Convert patterns to JSON-serializable
        patterns_serializable = make_json_serializable(patterns)
        
        return jsonify({
            'success': True,
            'patterns': {
                'sum_mean': float(patterns.get('sum_mean', 0)),
                'sum_std': float(patterns.get('sum_std', 0)),
                'sum_range': patterns.get('sum_range', [0, 0]),
                'even_mode': int(patterns.get('even_mode', 0)),
                'high_mode': int(patterns.get('high_mode', 0)),
                'hot_numbers': patterns.get('hot_numbers', []),
                'cold_numbers': patterns.get('cold_numbers', [])
            },
            'regime_change': make_json_serializable(regime) if regime else None,
            'data_points_used': len(draws)
        })
        
    except Exception as e:
        return jsonify({
            'error': 'Analysis failed',
            'message': str(e)
        }), 500


if __name__ == '__main__':
    # Use port 5001 by default to avoid conflict with backend (port 5000)
    port = int(os.environ.get('PORT', 5001))
    debug = os.environ.get('DEBUG', 'false').lower() == 'true'
    
    print(f"Starting Lotto Oracle Service on port {port}")
    print(f"Debug mode: {debug}")
    
    app.run(host='0.0.0.0', port=port, debug=debug)

