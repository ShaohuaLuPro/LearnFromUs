import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

function flattenOptions(options) {
  return options.flatMap((item) => {
    if (Array.isArray(item.options)) {
      return item.options;
    }
    return item;
  });
}

export default function Select({
  options,
  value,
  onChange,
  placeholder = 'Select',
  className = '',
  triggerClassName = '',
  menuClassName = '',
  disabled = false
}) {
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const optionRefs = useRef([]);
  const listboxId = useId();
  const flatOptions = useMemo(() => flattenOptions(options), [options]);
  const selectedIndex = useMemo(
    () => flatOptions.findIndex((option) => option.value === value),
    [flatOptions, value]
  );
  const selectedOption = selectedIndex >= 0 ? flatOptions[selectedIndex] : null;
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex >= 0 ? selectedIndex : 0);

  useEffect(() => {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [selectedIndex]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    if (isOpen && optionRefs.current[activeIndex]) {
      optionRefs.current[activeIndex].focus();
    }
  }, [activeIndex, isOpen]);

  const selectOption = (nextValue) => {
    setIsOpen(false);
    if (nextValue !== value) {
      onChange(nextValue);
    }
    triggerRef.current?.focus();
  };

  const openMenu = () => {
    if (disabled) {
      return;
    }
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setIsOpen(true);
  };

  const moveActiveIndex = (direction) => {
    if (flatOptions.length === 0) {
      return;
    }
    setActiveIndex((current) => {
      const nextIndex = current + direction;
      if (nextIndex < 0) {
        return flatOptions.length - 1;
      }
      if (nextIndex >= flatOptions.length) {
        return 0;
      }
      return nextIndex;
    });
  };

  const handleTriggerKeyDown = (event) => {
    if (disabled) {
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        openMenu();
        return;
      }
      moveActiveIndex(event.key === 'ArrowDown' ? 1 : -1);
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (isOpen) {
        if (flatOptions[activeIndex]) {
          selectOption(flatOptions[activeIndex].value);
        }
      } else {
        openMenu();
      }
    }
  };

  const handleOptionKeyDown = (event, optionIndex) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActiveIndex(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActiveIndex(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(flatOptions.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectOption(flatOptions[optionIndex].value);
    } else if (event.key === 'Tab') {
      setIsOpen(false);
    }
  };

  let runningIndex = -1;

  return (
    <div ref={rootRef} className={`forum-select ${className}`.trim()}>
      <button
        ref={triggerRef}
        type="button"
        className={`forum-select-trigger forum-input ${triggerClassName}`.trim()}
        onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
        onKeyDown={handleTriggerKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
      >
        <span className={`forum-select-value ${selectedOption ? '' : 'is-placeholder'}`.trim()}>
          {selectedOption?.label || placeholder}
        </span>
        <span className={`forum-select-caret ${isOpen ? 'is-open' : ''}`.trim()} aria-hidden="true">
          v
        </span>
      </button>

      {isOpen && !disabled && (
        <div id={listboxId} className={`forum-select-menu ${menuClassName}`.trim()} role="listbox">
          {options.map((item) => {
            if (Array.isArray(item.options)) {
              return (
                <div key={item.label} className="forum-select-group">
                  <div className="forum-select-group-label">{item.label}</div>
                  {item.options.map((option) => {
                    runningIndex += 1;
                    const optionIndex = runningIndex;
                    return (
                      <button
                        key={option.value}
                        ref={(element) => {
                          optionRefs.current[optionIndex] = element;
                        }}
                        type="button"
                        role="option"
                        aria-selected={option.value === value}
                        className={`forum-select-option ${option.value === value ? 'is-selected' : ''} ${optionIndex === activeIndex ? 'is-active' : ''}`.trim()}
                        onClick={() => selectOption(option.value)}
                        onKeyDown={(event) => handleOptionKeyDown(event, optionIndex)}
                        onMouseEnter={() => setActiveIndex(optionIndex)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              );
            }

            runningIndex += 1;
            const optionIndex = runningIndex;
            return (
              <button
                key={item.value}
                ref={(element) => {
                  optionRefs.current[optionIndex] = element;
                }}
                type="button"
                role="option"
                aria-selected={item.value === value}
                className={`forum-select-option ${item.value === value ? 'is-selected' : ''} ${optionIndex === activeIndex ? 'is-active' : ''}`.trim()}
                onClick={() => selectOption(item.value)}
                onKeyDown={(event) => handleOptionKeyDown(event, optionIndex)}
                onMouseEnter={() => setActiveIndex(optionIndex)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
