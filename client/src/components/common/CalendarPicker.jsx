import React, { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";

/**
 * A custom, premium glassmorphic date picker component.
 * Designed to replace generic HTML date inputs with a high-fidelity interface.
 */
const CalendarPicker = ({ value, onChange, minDate, maxDate, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value ? new Date(value) : new Date());
  const containerRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return "";
    // Handle YYYY-MM-DD
    const [y, m, d] = dateString.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleSelectDate = (day) => {
    const selected = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    const yyyy = selected.getFullYear();
    const mm = String(selected.getMonth() + 1).padStart(2, "0");
    const dd = String(selected.getDate()).padStart(2, "0");
    onChange(`${yyyy}-${mm}-${dd}`);
    setIsOpen(false);
  };

  const isDateDisabled = (day) => {
    const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    
    if (minDate) {
      const [y, m, d] = minDate.split("-").map(Number);
      const min = new Date(y, m - 1, d);
      min.setHours(0, 0, 0, 0);
      date.setHours(0, 0, 0, 0);
      if (date < min) return true;
    }
    
    if (maxDate) {
      const [y, m, d] = maxDate.split("-").map(Number);
      const max = new Date(y, m - 1, d);
      max.setHours(23, 59, 59, 999);
      if (date > max) return true;
    }
    
    return false;
  };

  const isSelected = (day) => {
    if (!value) return false;
    const [vy, vm, vd] = value.split("-").map(Number);
    return (
      vy === viewDate.getFullYear() &&
      vm === viewDate.getMonth() + 1 &&
      vd === day
    );
  };

  const daysInMonth = getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth());
  const firstDay = getFirstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth());
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const monthName = viewDate.toLocaleString("default", { month: "long" });

  return (
    <div className="calendar-picker-container" ref={containerRef}>
      {label && <label className="calendar-label">{label}</label>}
      <div 
        className={`calendar-input-wrapper ${isOpen ? "active" : ""}`} 
        onClick={() => setIsOpen(!isOpen)}
      >
        <CalendarIcon size={16} className="calendar-icon-svg" style={{ color: "var(--text3)" }} />
        <span className={`calendar-value ${!value ? "placeholder" : ""}`}>
          {value ? formatDate(value) : "Select date"}
        </span>
      </div>

      {isOpen && (
        <div className="calendar-dropdown">
          <div className="calendar-nav">
            <button onClick={handlePrevMonth} className="nav-btn">
              <ChevronLeft size={16} />
            </button>
            <span className="month-year">{monthName} {viewDate.getFullYear()}</span>
            <button onClick={handleNextMonth} className="nav-btn">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="calendar-grid">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
              <div key={d} className="day-name">{d}</div>
            ))}
            {Array(firstDay).fill(null).map((_, i) => <div key={`empty-${i}`} />)}
            {days.map(day => (
              <button
                key={day}
                className={`day-btn ${isSelected(day) ? "selected" : ""} ${isDateDisabled(day) ? "disabled" : ""}`}
                disabled={isDateDisabled(day)}
                onClick={() => handleSelectDate(day)}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .calendar-picker-container { 
          position: relative; 
          width: 100%; 
        }
        .calendar-label { 
          display: block; 
          font-size: 0.85rem; 
          font-weight: 600; 
          color: var(--text2); 
          margin-bottom: 8px; 
        }
        .calendar-input-wrapper { 
          display: flex; 
          align-items: center; 
          gap: 12px; 
          padding: 12px 16px;
          background: rgba(15, 23, 42, 0.4); 
          border: 1px solid var(--glass-border);
          border-radius: 12px; 
          cursor: pointer; 
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .calendar-input-wrapper:hover { 
          border-color: var(--glass-border-hover); 
          background: rgba(15, 23, 42, 0.55); 
        }
        .calendar-input-wrapper.active {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }
        .calendar-value { 
          font-size: 0.95rem; 
          color: var(--text); 
          user-select: none;
        }
        .calendar-value.placeholder { 
          color: var(--text3); 
        }
        .calendar-dropdown {
          position: absolute; 
          top: calc(100% + 12px); 
          left: 0; 
          z-index: 1000;
          width: 300px; 
          padding: 20px; 
          background: var(--glass-bg-stronger);
          backdrop-filter: blur(20px); 
          border: 1px solid var(--glass-border);
          border-radius: 16px; 
          box-shadow: var(--glass-shadow-lg);
          animation: calendarReveal 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes calendarReveal {
          from { opacity: 0; transform: translateY(-15px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .calendar-nav { 
          display: flex; 
          align-items: center; 
          justify-content: space-between; 
          margin-bottom: 16px; 
        }
        .nav-btn { 
          background: rgba(255, 255, 255, 0.03); 
          border: 1px solid rgba(255, 255, 255, 0.05); 
          color: var(--text2); 
          cursor: pointer; 
          padding: 6px; 
          border-radius: 8px; 
          transition: 0.2s; 
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .nav-btn:hover { 
          background: rgba(255, 255, 255, 0.08); 
          color: var(--text); 
          border-color: rgba(255, 255, 255, 0.1);
        }
        .month-year { 
          font-weight: 700; 
          color: var(--text); 
          font-size: 1rem; 
          letter-spacing: -0.01em;
        }
        .calendar-grid { 
          display: grid; 
          grid-template-columns: repeat(7, 1fr); 
          gap: 6px; 
        }
        .day-name { 
          text-align: center; 
          font-size: 0.75rem; 
          font-weight: 700; 
          color: var(--text3); 
          padding: 4px 0; 
          text-transform: uppercase;
        }
        .day-btn {
          aspect-ratio: 1; 
          border: none; 
          background: none; 
          color: var(--text2);
          font-size: 0.9rem; 
          border-radius: 10px; 
          cursor: pointer; 
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .day-btn:hover:not(:disabled) { 
          background: rgba(255, 255, 255, 0.1); 
          color: var(--text);
          transform: scale(1.05);
        }
        .day-btn.selected { 
          background: #3b82f6 !important; 
          color: white !important; 
          font-weight: 700; 
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }
        .day-btn.disabled { 
          opacity: 0.1; 
          cursor: not-allowed; 
        }
      `}} />
    </div>
  );
};

export default CalendarPicker;
