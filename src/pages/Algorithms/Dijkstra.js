// src/pages/Algorithms/Dijkstra.js
import React, { useState } from 'react';

export default function Dijkstra() {
  const [output, setOutput] = useState(null);

  const graph = {
    A: { B: 1, C: 4 },
    B: { C: 2, D: 5 },
    C: { D: 1 },
    D: {}
  };

  const dijkstra = (graph, start) => {
    const distances = {};
    const visited = {};
    const queue = [];

    Object.keys(graph).forEach(node => {
      distances[node] = node === start ? 0 : Infinity;
    });

    queue.push({ node: start, distance: 0 });

    while (queue.length) {
      queue.sort((a, b) => a.distance - b.distance);
      const { node } = queue.shift();

      if (visited[node]) continue;
      visited[node] = true;

      for (const neighbor in graph[node]) {
        const newDist = distances[node] + graph[node][neighbor];
        if (newDist < distances[neighbor]) {
          distances[neighbor] = newDist;
          queue.push({ node: neighbor, distance: newDist });
        }
      }
    }

    return distances;
  };

  const handleRun = () => {
    const result = dijkstra(graph, 'A');
    setOutput(result);
  };

  const code = `function dijkstra(graph, start) {
  const distances = {};
  const visited = {};
  const queue = [];

  for (const node in graph) {
    distances[node] = node === start ? 0 : Infinity;
  }

  queue.push({ node: start, distance: 0 });

  while (queue.length) {
    queue.sort((a, b) => a.distance - b.distance);
    const { node } = queue.shift();

    if (visited[node]) continue;
    visited[node] = true;

    for (const neighbor in graph[node]) {
      const newDist = distances[node] + graph[node][neighbor];
      if (newDist < distances[neighbor]) {
        distances[neighbor] = newDist;
        queue.push({ node: neighbor, distance: newDist });
      }
    }
  }

  return distances;
}`;

  return (
    <div className="container pt-1">
      <h2>Dijkstra's Algorithm</h2>

      <div className="mb-3">
        <strong>Graph Input (Adjacency List):</strong>
        <pre className="bg-light p-2 rounded">
          <code>{JSON.stringify(graph, null, 2)}</code>
        </pre>
      </div>

      <button className="btn btn-primary mb-3" onClick={handleRun}>
        Run Dijkstra from Node A
      </button>

      {output && (
        <div className="mb-3">
          <strong>Shortest Distances from A:</strong>
          <pre>{JSON.stringify(output, null, 2)}</pre>
        </div>
      )}

      <pre className="bg-light p-3 rounded">
        <code>{code}</code>
      </pre>

      <div className="mt-4">
        <h5>How Dijkstra's Algorithm Works:</h5>
        <p>
          Dijkstra's algorithm finds the shortest path from a starting node to all other nodes in a weighted graph.
          It uses a priority queue to always expand the next closest node, updating distances as it goes.
        </p>
        <p><strong>Time Complexity:</strong> O(E log V) with a binary heap</p>
      </div>
    </div>
  );
}