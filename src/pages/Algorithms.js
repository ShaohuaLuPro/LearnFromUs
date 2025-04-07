import React, { useState, useRef, useEffect } from 'react';
import { Form, Card } from 'react-bootstrap';

// Placeholder algorithm components
const BubbleSort = () => <p>Bubble Sort Visualizer Coming Soon...</p>;
const Dijkstra = () => <p>Dijkstra's Algorithm Visualizer Coming Soon...</p>;

const algorithmList = [
  { name: 'Bubble Sort', component: <BubbleSort /> },
  { name: "Dijkstra's Algorithm", component: <Dijkstra /> },
  // Add more algorithms here
];

export default function Algorithms() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef();

  const filtered = algorithmList.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  // Click outside to close
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
    <div className="container mt-5 pt-5">
      <h2>Algorithm Visualizations</h2>

      {/* Dropdown with search */}
      <div ref={dropdownRef} style={{ maxWidth: '400px' }} className="position-relative mb-4">
        <button
          className="btn btn-outline-success w-100 text-start"
          onClick={() => setOpen(!open)}
        >
          {selected?.name || 'Select an Algorithm'}
        </button>

        {open && (
          <div className="border position-absolute bg-white w-100 shadow mt-1 z-1" style={{ maxHeight: '250px', overflowY: 'auto' }}>
            <Form.Control
              type="text"
              placeholder="Search algorithms..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="border-bottom"
            />
            <ul className="list-group list-group-flush">
              {filtered.map((item, idx) => (
                <li
                  key={idx}
                  className="list-group-item list-group-item-action"
                  style={{ cursor: 'pointer' }}
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

      {/* Selected algorithm demo */}
      <div>
        {selected ? (
          <Card className="p-3">
            <h5>{selected.name}</h5>
            {selected.component}
          </Card>
        ) : (
          <p>Select an algorithm from the dropdown above.</p>
        )}
      </div>
    </div>
  );
}