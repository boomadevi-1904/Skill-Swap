import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import OTPInput from "../components/OTPInput";

export default function VerifyOTP() {
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;

  useEffect(() => {
    if (!email) {
      navigate("/signup");
      return;
    }

    let timer;
    if (resendTimer > 0) {
      timer = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendTimer, email, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError("Please enter all 6 digits");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/verify-otp", { email, otp });
      login(data.user, data.token);
      navigate(data.user.role === "admin" ? "/admin" : "/dashboard");
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Verification failed";
      setError(msg);
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    
    setResendLoading(true);
    setError("");
    setResendMessage("");
    try {
      await api.post("/api/auth/resend-otp", { email });
      setResendTimer(60);
      setResendMessage("New code sent successfully!");
      setOtp(""); // Clear previous OTP
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Failed to resend";
      setError(msg);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-primary-light/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-light text-white text-3xl mb-4 shadow-lg">
            📩
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Verify Email</h1>
          <p className="text-gray-500 mt-2">
            We've sent a 6-digit code to <br />
            <span className="font-semibold text-gray-700">{email}</span>
          </p>
        </div>

        <div className="card-elevated p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            <OTPInput 
              value={otp} 
              onChange={(val) => {
                setOtp(val);
                if (error) setError("");
              }}
              error={error}
            />
            
            <button 
              type="submit" 
              className="btn-primary w-full py-3 text-lg font-bold" 
              disabled={loading || otp.length !== 6}
            >
              {loading ? "Verifying..." : "Verify & Create Account"}
            </button>
          </form>

          <div className="mt-8 text-center space-y-4">
            {resendMessage && (
              <p className="text-green-600 text-sm font-medium">{resendMessage}</p>
            )}
            
            <p className="text-gray-600 text-sm">
              Didn't receive the code?{" "}
              <button
                type="button"
                onClick={handleResend}
                disabled={resendTimer > 0 || resendLoading}
                className={`font-bold transition-colors ${
                  resendTimer > 0 
                    ? 'text-gray-400 cursor-not-allowed' 
                    : 'text-primary hover:text-primary-dark hover:underline'
                }`}
              >
                {resendLoading ? "Sending..." : resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend Now"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
