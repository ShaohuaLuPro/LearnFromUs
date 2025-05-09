// src/pages/MLModel/KMeans.js
import React, { useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as d3 from 'd3';

export default function KMeans() {
  const [clusters, setClusters] = useState([]);
  const [centroids, setCentroids] = useState([]);
  const [status, setStatus] = useState('');

  const fetchAndCluster = async () => {
    setStatus('Loading Iris dataset...');

    const irisUrl = 'https://raw.githubusercontent.com/uiuc-cse/data-fa14/gh-pages/data/iris.csv';
    const raw = await d3.csv(irisUrl, d => ({
      sepalLength: +d.sepal_length,
      sepalWidth: +d.sepal_width,
      petalLength: +d.petal_length,
      petalWidth: +d.petal_width
    }));

    setStatus('Clustering...');

    const data = raw.map(d => [d.sepalLength, d.sepalWidth]);
    const k = 3;
    const maxIter = 10;

    let points = tf.tensor2d(data);
    let centroids = tf.slice(points, [0, 0], [k, -1]);

    for (let iter = 0; iter < maxIter; iter++) {
      const expandedPoints = points.expandDims(1);
      const expandedCentroids = centroids.expandDims(0);

      const distances = expandedPoints
        .sub(expandedCentroids)
        .square()
        .sum(2);

      const assignments = distances.argMin(1);

      const newCentroids = [];
      for (let i = 0; i < k; i++) {
        const mask = assignments.equal(i);
        const clusterPoints = points.mul(mask.cast('float32').expandDims(1));
        const count = mask.sum().arraySync();
        const sum = clusterPoints.sum(0);
        newCentroids.push(sum.div(count));
      }

      centroids = tf.stack(newCentroids);
    }

    const finalAssignments = points.sub(centroids.expandDims(0)).square().sum(2).argMin(1).arraySync();

    setClusters(data.map((p, i) => ({ x: p[0], y: p[1], cluster: finalAssignments[i] })));
    setCentroids(centroids.arraySync());
    setStatus('Clustering complete.');
  };

  return (
    <div className="container pt-5">
      <h2>K-Means Clustering on Iris Dataset</h2>
      <p>This example uses <code>@tensorflow/tfjs</code> and <code>d3</code> to perform K-means clustering on the Sepal dimensions of the Iris dataset.</p>

      <button className="btn btn-primary mb-3" onClick={fetchAndCluster}>Run K-Means</button>
      {status && <p><strong>Status:</strong> {status}</p>}

      {clusters.length > 0 && (
        <div className="mt-4">
          <h5>Clustered Data Points (Sepal Length vs Width):</h5>
          <div className="border p-3" style={{ whiteSpace: 'pre-wrap' }}>
            {clusters.map((pt, i) => `Point ${i + 1}: (${pt.x}, ${pt.y}) → Cluster ${pt.cluster}`).join('\n')}
          </div>
          <p className="mt-3">
            Final Centroids: {centroids.map((c, i) => `Cluster ${i}: (${c[0].toFixed(2)}, ${c[1].toFixed(2)})`).join(', ')}
          </p>
        </div>
      )}

      <div className="mt-4">
        <h5>How K-Means Works:</h5>
        <p>K-means clustering partitions data into <strong>K groups</strong> by minimizing intra-cluster distances. It begins with random centroids and iteratively assigns data points to the nearest centroid and updates centroids to the mean of assigned points.</p>
        <p><strong>Dataset:</strong> Iris (UCI ML repository)</p>
        <p><strong>Packages Used:</strong> <code>@tensorflow/tfjs</code>, <code>d3</code></p>
      </div>
    </div>
  );
}