// src/pages/Algorithms/BubbleSort.js
import React, { useState } from 'react';

export default function BubbleSort() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState([]);
  const [showExplanation, setShowExplanation] = useState(false);

  const handleSort = () => {
    const nums = input
      .split(',')
      .map(n => parseInt(n.trim()))
      .filter(n => !isNaN(n));

    const arr = [...nums];
    for (let i = 0; i < arr.length - 1; i++) {
      for (let j = 0; j < arr.length - 1 - i; j++) {
        if (arr[j] > arr[j + 1]) {
          [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
        }
      }
    }

    setOutput(arr);
    setShowExplanation(true);
  };

  const code = `function bubbleSort(arr) {
  for (let i = 0; i < arr.length - 1; i++) {
    for (let j = 0; j < arr.length - 1 - i; j++) {
      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
      }
    }
  }
  return arr;
}`;

  return (
    <div className="container pt-2">
      <h2>Bubble Sort Demo</h2>

      <div className="mb-3">
        <label>Enter numbers separated by commas:</label>
        <input
          type="text"
          className="form-control"
          placeholder="e.g. 5, 1, 4, 2, 8"
          value={input}
          onChange={e => setInput(e.target.value)}
        />
      </div>

      <button className="btn btn-primary mb-3" onClick={handleSort}>
        Sort
      </button>

      {output.length > 0 && (
        <div className="mb-3">
          <strong>Sorted Output:</strong>
          <div>[{output.join(', ')}]</div>
        </div>
      )}

      <pre className="bg-light p-3 rounded">
        <code>{code}</code>
      </pre>

      {showExplanation && (
        <div className="mt-4">
          <h5>How Bubble Sort Works:</h5>
          <p>
            Bubble Sort compares each pair of adjacent elements and swaps them if they are in the wrong order. With each full pass,
            the largest remaining unsorted value "bubbles" to the end. This continues until the array is sorted.
          </p>
          <p>
            <strong>Time Complexity:</strong> O(n²)<br />
            <strong>Space Complexity:</strong> O(1)<br />
            Great for teaching — not great for performance.
          </p>
        </div>
      )}
    </div>
  );
}