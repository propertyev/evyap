'use client';

import { Bar } from 'react-chartjs-2';
import {
  BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip,
} from 'chart.js';

ChartJS.register(BarElement, CategoryScale, LinearScale, Legend, Tooltip);

export function DashboardChart({ labels, sales, profit }: { labels: string[]; sales: number[]; profit: number[] }) {
  return (
    <div className="chartbox">
      <Bar
        aria-label="Monthly sales versus net profit"
        data={{
          labels,
          datasets: [
            { label: 'SALES', data: sales.map((v) => v / 100), backgroundColor: '#FFC000' },
            { label: 'NET PROFIT / (LOSS)', data: profit.map((v) => v / 100), backgroundColor: '#11254B' },
          ],
        }}
        options={{
          plugins: { legend: { labels: { color: '#333', boxWidth: 10, font: { size: 10 } } } },
          scales: {
            x: { ticks: { color: '#333', font: { size: 9 } }, grid: { display: false } },
            y: { ticks: { color: '#333', font: { size: 9 } }, grid: { color: '#ddd' } },
          },
        }}
      />
    </div>
  );
}
