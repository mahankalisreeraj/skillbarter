import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Line
} from 'recharts';

interface WeeklyActivity {
  date: string;
  hours_taught: number;
  credits_earned: number;
}

interface WeeklyPerformanceGraphProps {
  data: WeeklyActivity[];
}

export default function WeeklyPerformanceGraph({ data }: WeeklyPerformanceGraphProps) {
  // Format dates for display (e.g., "Mon 15")
  const formattedData = data.map(item => {
    const d = new Date(item.date);
    return {
      ...item,
      displayDate: d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
    };
  });

  return (
    <div className="card p-6 mt-8">
      <h3 className="text-lg font-bold mb-6 text-slate-700">Weekly Performance</h3>
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={formattedData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis 
              dataKey="displayDate" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748B', fontSize: 12 }}
              dy={10}
            />
            <YAxis 
              yAxisId="left"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748B', fontSize: 12 }}
            />
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748B', fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            
            <Bar 
              yAxisId="left" 
              dataKey="hours_taught" 
              name="Hours Taught" 
              fill="#3b82f6" 
              radius={[4, 4, 0, 0]} 
              maxBarSize={40}
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="credits_earned" 
              name="Credits Earned" 
              stroke="#f59e0b" 
              strokeWidth={3}
              dot={{ r: 4, fill: '#f59e0b', strokeWidth: 0 }}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
