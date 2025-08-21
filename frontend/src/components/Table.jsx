import React from 'react';

export default function Table({ columns, data }) {
  return (
    <table className="min-w-full bg-white border">
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col} className="px-4 py-2 border-b">{col}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i}>
            {columns.map((col) => (
              <td key={col} className="px-4 py-2 border-b">{row[col]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
