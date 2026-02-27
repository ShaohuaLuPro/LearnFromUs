import React, { useState, useRef, useEffect } from 'react';
import { Form, Card } from 'react-bootstrap';
import { algorithmList } from './Algorithms';

export default function Algorithm() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef();

  const filtered = algorithmList.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = e => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="container page-shell">
      <h2 className="section-title">Algorithm Visualizations</h2>
      <p className="muted">Pick an algorithm and inspect its behavior visually.</p>

      <div ref={dropdownRef} className="position-relative mb-4 picker-wrap">
        <button
          className="btn w-100 text-start picker-btn"
          onClick={() => setOpen(!open)}
        >
          {selected?.name || 'Select an Algorithm'}
        </button>

        {open && (
          <div className="position-absolute w-100 mt-1 z-1 picker-menu" style={{ maxHeight: '260px', overflowY: 'auto' }}>
            <Form.Control
              type="text"
              placeholder="Search algorithms..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="border-0 border-bottom rounded-0"
            />
            <ul className="list-group list-group-flush">
              {filtered.map((item, idx) => (
                <li
                  key={idx}
                  className="list-group-item list-group-item-action picker-item"
                  onClick={() => {
                    setSelected(item);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  {item.name}
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="list-group-item text-muted">No results</li>
              )}
            </ul>
          </div>
        )}
      </div>

      <div>
        {selected ? (
          <Card className="p-3 panel">
            <h5>{selected.name}</h5>
            {selected.component}
          </Card>
        ) : (
          <p className="muted">Select an algorithm from the picker above.</p>
        )}
      </div>
    </div>
  );
}
