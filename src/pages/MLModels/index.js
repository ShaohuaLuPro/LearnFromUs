import LogisticRegression from './LogisticRegression';
import KMeans from './KMeans';

export const mlModels = [
  { name: 'Logistic Regression', component: <LogisticRegression /> },
  { name: 'K-Means Clustering', component: <KMeans /> },
];
