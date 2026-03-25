import React, { useRef, useEffect } from 'react';

export default function OTPInput({ length = 6, value, onChange, error }) {
  const inputRefs = useRef([]);

  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleChange = (e, index) => {
    const val = e.target.value;
    if (isNaN(val)) return;

    const newOTP = value.split('');
    newOTP[index] = val.substring(val.length - 1);
    const combinedOTP = newOTP.join('');
    onChange(combinedOTP);

    if (val && index < length - 1) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handlePaste = (e) => {
    const data = e.clipboardData.getData('text').slice(0, length);
    if (isNaN(data)) return;
    onChange(data);
    inputRefs.current[Math.min(data.length, length - 1)].focus();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-2 sm:gap-4 justify-center" onPaste={handlePaste}>
        {Array.from({ length }).map((_, index) => (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={value[index] || ''}
            onChange={(e) => handleChange(e, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`w-10 h-12 sm:w-12 sm:h-14 text-center text-2xl font-bold border-2 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all ${
              error ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'
            }`}
          />
        ))}
      </div>
      {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
    </div>
  );
}
