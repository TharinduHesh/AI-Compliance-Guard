"""
Module 6: Audit Risk Prediction Model
ML-based prediction of audit readiness and risk level
"""

import logging
from typing import Dict, List, Tuple
import numpy as np
import pickle
from pathlib import Path

from app.config.settings import settings

logger = logging.getLogger(__name__)


class AuditRiskPredictor:
    """
    Machine Learning model for predicting audit risk
    Classifies documents into Low, Medium, or High risk categories
    """
    
    def __init__(self):
        self.model = None
        self.scaler = None
        self.model_path = Path(settings.AUDIT_MODEL_PATH)
        self.scaler_path = Path(settings.AUDIT_SCALER_PATH)
        self.risk_levels = ['Low Risk', 'Medium Risk', 'High Risk']
        
        # Load or initialize model
        self._load_or_initialize_model()
    
    def _load_or_initialize_model(self):
        """Load existing model or create new one"""
        if self.model_path.exists() and self.scaler_path.exists():
            try:
                with open(self.model_path, 'rb') as f:
                    self.model = pickle.load(f)
                with open(self.scaler_path, 'rb') as f:
                    self.scaler = pickle.load(f)
                logger.info("Audit prediction model loaded successfully")
            except Exception as e:
                logger.warning(f"Failed to load model: {str(e)}. Initializing new model.")
                self._initialize_model()
        else:
            self._initialize_model()
    
    def _initialize_model(self):
        """Initialize new Random Forest model with synthetic data"""
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.preprocessing import StandardScaler
        
        logger.info("Initializing new audit prediction model")
        
        # Create synthetic training data (replace with real data in production)
        X_train, y_train = self._generate_synthetic_training_data()
        
        # Initialize scaler
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X_train)
        
        # Initialize and train Random Forest
        self.model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            random_state=42,
            class_weight='balanced'
        )
        self.model.fit(X_scaled, y_train)
        
        # Save model
        self._save_model()
        
        logger.info("Audit prediction model initialized and trained")
    
    def _generate_synthetic_training_data(self, n_samples: int = 300) -> Tuple[np.ndarray, np.ndarray]:
        """Generate synthetic training data for demonstration"""
        np.random.seed(42)
        
        # Features: [missing_controls_count, cia_imbalance, weak_statements_freq, coverage_pct]
        # Low Risk: few missing, balanced CIA, few weak statements, high coverage
        low_risk = np.random.uniform([0, 0, 0, 80], [5, 20, 5, 100], (n_samples // 3, 4))
        
        # Medium Risk: moderate missing, some imbalance, moderate weak statements
        medium_risk = np.random.uniform([5, 20, 5, 50], [15, 50, 15, 80], (n_samples // 3, 4))
        
        # High Risk: many missing, high imbalance, many weak statements, low coverage
        high_risk = np.random.uniform([15, 50, 15, 0], [50, 100, 50, 50], (n_samples // 3, 4))
        
        X = np.vstack([low_risk, medium_risk, high_risk])
        y = np.array([0] * (n_samples // 3) + [1] * (n_samples // 3) + [2] * (n_samples // 3))
        
        # Shuffle
        indices = np.random.permutation(len(X))
        return X[indices], y[indices]
    
    def extract_features(self, analysis_results: Dict[str, any]) -> np.ndarray:
        """
        Extract features from compliance analysis results
        
        Args:
            analysis_results: Combined results from all modules
            
        Returns:
            Feature vector for prediction
        """
        # Feature 1: Missing controls count
        missing_controls = analysis_results.get('missing_controls_count', 0)
        
        # Feature 2: CIA imbalance score (100 - balance_index)
        cia_balance = analysis_results.get('cia_balance_index', 50)
        cia_imbalance = 100 - cia_balance
        
        # Feature 3: Weak statements frequency (per 100 clauses)
        weak_clauses_count = len(analysis_results.get('weak_clauses', []))
        total_clauses = analysis_results.get('total_clauses', 1)
        weak_statements_freq = (weak_clauses_count / total_clauses) * 100
        
        # Feature 4: Compliance coverage percentage
        coverage_pct = analysis_results.get('compliance_percentage', 0)
        
        features = np.array([
            missing_controls,
            cia_imbalance,
            weak_statements_freq,
            coverage_pct
        ]).reshape(1, -1)
        
        return features
    
    def predict_risk(self, analysis_results: Dict[str, any]) -> Dict[str, any]:
        """
        Predict audit risk level
        
        Args:
            analysis_results: Combined compliance analysis results
            
        Returns:
            Risk prediction with confidence scores
        """
        # Deterministic normalized scoring produces more stable and explainable output
        # than the synthetic demonstration model.
        missing_controls = max(float(analysis_results.get('missing_controls_count', 0)), 0.0)
        total_controls = max(float(analysis_results.get('total_controls', 1)), 1.0)
        missing_ratio = min(missing_controls / total_controls, 1.0)

        weak_clauses_count = len(analysis_results.get('weak_clauses', []))
        total_clauses = max(float(analysis_results.get('total_clauses', 1)), 1.0)
        weak_ratio = min(float(weak_clauses_count) / total_clauses, 1.0)

        coverage_pct = float(analysis_results.get('compliance_percentage', 0.0))
        coverage_gap = min(max((100.0 - coverage_pct) / 100.0, 0.0), 1.0)

        cia_balance = analysis_results.get('cia_balance_index', None)
        if cia_balance is None:
            cia_penalty = 0.0
        else:
            cia_penalty = min(max((60.0 - float(cia_balance)) / 60.0, 0.0), 1.0)

        weighted_risk = (
            (0.40 * missing_ratio)
            + (0.30 * coverage_gap)
            + (0.20 * weak_ratio)
            + (0.10 * cia_penalty)
        )
        risk_index = round(weighted_risk * 100, 2)

        if risk_index >= 67:
            risk_level = 'High Risk'
            risk_score = 2
        elif risk_index >= 40:
            risk_level = 'Medium Risk'
            risk_score = 1
        else:
            risk_level = 'Low Risk'
            risk_score = 0

        # Soft probability distribution around deterministic risk index.
        p_high = max(0.0, min(1.0, (risk_index - 35) / 65))
        p_low = max(0.0, min(1.0, (70 - risk_index) / 70))
        p_medium = max(0.0, 1.0 - max(p_low, p_high))
        total_p = p_low + p_medium + p_high
        if total_p == 0:
            p_low, p_medium, p_high = 0.33, 0.34, 0.33
        else:
            p_low, p_medium, p_high = p_low / total_p, p_medium / total_p, p_high / total_p

        confidence = max(p_low, p_medium, p_high) * 100

        feature_contributions = {
            'Missing Controls': round(missing_ratio * 100, 2),
            'CIA Imbalance': round(cia_penalty * 100, 2),
            'Weak Statements': round(weak_ratio * 100, 2),
            'Coverage Percentage': round(coverage_pct, 2),
        }

        return {
            'risk_level': risk_level,
            'confidence': round(confidence, 2),
            'risk_score': risk_score,
            'probability_distribution': {
                'Low Risk': round(p_low * 100, 2),
                'Medium Risk': round(p_medium * 100, 2),
                'High Risk': round(p_high * 100, 2)
            },
            'feature_contributions': feature_contributions,
            'recommendations': self._generate_risk_recommendations(risk_level, feature_contributions)
        }
    
    def _generate_risk_recommendations(self, risk_level: str, 
                                      feature_contributions: Dict[str, float]) -> List[str]:
        """Generate recommendations based on risk prediction"""
        recommendations = []
        
        if risk_level == 'High Risk':
            recommendations.append(
                "🔴 HIGH RISK: Immediate action required. Address critical gaps before audit."
            )
            
            if feature_contributions['Missing Controls'] > 15:
                recommendations.append(
                    "- Implement missing controls as priority"
                )
            
            if feature_contributions['CIA Imbalance'] > 50:
                recommendations.append(
                    "- Balance CIA coverage across all three pillars"
                )
            
            if feature_contributions['Coverage Percentage'] < 50:
                recommendations.append(
                    "- Expand policy documentation to improve coverage"
                )
                
        elif risk_level == 'Medium Risk':
            recommendations.append(
                "🟡 MEDIUM RISK: Improvements needed. Focus on key gaps."
            )
            recommendations.append(
                "- Review and strengthen weak policy statements"
            )
            recommendations.append(
                "- Address identified control gaps"
            )
            
        else:  # Low Risk
            recommendations.append(
                "🟢 LOW RISK: Good compliance posture. Continue monitoring."
            )
            recommendations.append(
                "- Maintain current documentation quality"
            )
            recommendations.append(
                "- Conduct regular reviews to ensure ongoing compliance"
            )
        
        return recommendations
    
    def _save_model(self):
        """Save trained model and scaler"""
        try:
            self.model_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(self.model_path, 'wb') as f:
                pickle.dump(self.model, f)
            
            with open(self.scaler_path, 'wb') as f:
                pickle.dump(self.scaler, f)
            
            logger.info("Model saved successfully")
        except Exception as e:
            logger.error(f"Failed to save model: {str(e)}")
    
    def get_audit_readiness_score(self, risk_prediction: Dict[str, any], analysis_context: Dict[str, any] = None) -> Dict[str, any]:
        """
        Calculate audit readiness score (0-100)
        
        Args:
            risk_prediction: Risk prediction results
            
        Returns:
            Audit readiness assessment
        """
        probabilities = risk_prediction.get('probability_distribution', {})
        
        # Readiness score: weighted by risk probabilities (inverse)
        readiness_score = (
            probabilities.get('Low Risk', 0) * 1.0 +
            probabilities.get('Medium Risk', 0) * 0.5 +
            probabilities.get('High Risk', 0) * 0.0
        )

        # Apply conservative penalties based on real analysis signals.
        analysis_context = analysis_context or {}
        structural_score = float(analysis_context.get('structural_score', 0.0))
        compliance_percentage = float(analysis_context.get('compliance_percentage', 0.0))
        missing_critical_count = int(analysis_context.get('missing_critical_count', 0) or 0)

        readiness_score -= max(0.0, (70.0 - structural_score) * 0.45)
        readiness_score -= max(0.0, (85.0 - compliance_percentage) * 0.30)
        readiness_score -= min(20.0, missing_critical_count * 3.0)
        readiness_score = max(0.0, min(100.0, readiness_score))

        risk_level = risk_prediction.get('risk_level', 'Unknown')
        
        if readiness_score >= 85 and risk_level == 'Low Risk' and missing_critical_count == 0 and structural_score >= 75:
            readiness_level = "Audit Ready"
        elif readiness_score >= 65:
            readiness_level = "Mostly Ready"
        elif readiness_score >= 45:
            readiness_level = "Preparing"
        else:
            readiness_level = "Not Ready"
        
        return {
            'audit_readiness_score': round(readiness_score, 2),
            'readiness_level': readiness_level,
            'recommendation': self._get_readiness_recommendation(readiness_level)
        }
    
    def _get_readiness_recommendation(self, readiness_level: str) -> str:
        """Get recommendation based on readiness level"""
        recommendations = {
            "Audit Ready": "Your compliance documentation is audit-ready. Maintain current standards.",
            "Mostly Ready": "Address minor gaps and strengthen weak areas before audit.",
            "Preparing": "Significant work needed. Focus on critical controls and coverage.",
            "Not Ready": "Major gaps identified. Comprehensive remediation required before audit."
        }
        return recommendations.get(readiness_level, "")


# Lazy singleton instance
_audit_predictor_instance = None

def _get_audit_predictor():
    global _audit_predictor_instance
    if _audit_predictor_instance is None:
        _audit_predictor_instance = AuditRiskPredictor()
    return _audit_predictor_instance

class _LazyAuditPredictor:
    """Proxy that defers AuditRiskPredictor construction until first use."""
    def __getattr__(self, name):
        return getattr(_get_audit_predictor(), name)

audit_predictor = _LazyAuditPredictor()
