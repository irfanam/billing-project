import React from 'react';

export default function StatsCard({ title, value }) {
  return (
    <div className="bg-white shadow rounded p-4 text-center">
      <div className="text-lg font-semibold">{title}</div>
      <div className="text-2xl font-bold mt-2">{value}</div>
    </div>
  );
}
