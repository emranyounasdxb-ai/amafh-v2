import { Card } from '../ui/card'
import './chart.css'

export interface ChartDatum { label: string; value: number }
export interface BarChartProps { title: string; data: ChartDatum[]; valueLabel?: (value: number) => string; color?: 'primary' | 'secondary' | 'tertiary' }

export function BarChart({ title, data, valueLabel = value => String(value), color = 'primary' }: BarChartProps) {
  const max = Math.max(1, ...data.map(item => item.value))
  return <Card className="amafh-chart" role="group" aria-label={title}>
    <h3 className="amafh-h4">{title}</h3>
    {data.length === 0 ? <p>No chart data available.</p> : <div className="amafh-chart__bars" aria-hidden="true">{data.map(item => <div className="amafh-chart__bar" key={item.label}><div className="amafh-chart__track"><div className={`amafh-chart__fill amafh-chart__fill--${color}`} style={{ width: `${Math.max(0, item.value) / max * 100}%` }} /></div><span>{item.label}</span><strong>{valueLabel(item.value)}</strong></div>)}</div>}
    {data.length > 0 && <table className="amafh-sr-only"><caption>{title} data</caption><thead><tr><th scope="col">Category</th><th scope="col">Value</th></tr></thead><tbody>{data.map(item => <tr key={item.label}><th scope="row">{item.label}</th><td>{valueLabel(item.value)}</td></tr>)}</tbody></table>}
  </Card>
}

export interface ProgressProps { label: string; value: number; max?: number }
export function Progress({ label, value, max = 100 }: ProgressProps) {
  const percentage = max > 0 ? Math.max(0, Math.min(100, value / max * 100)) : 0
  return <div className="amafh-progress"><div><span>{label}</span><strong>{Math.round(percentage)}%</strong></div><progress value={Math.max(0, Math.min(value, max))} max={max} aria-label={label} /></div>
}

export function LineChart({ title, data, valueLabel = value => String(value) }: Omit<BarChartProps, 'color'>) {
  const max = Math.max(1, ...data.map(item => item.value))
  const width = 320
  const height = 120
  const points = data.map((item, index) => `${data.length === 1 ? width / 2 : index * width / (data.length - 1)},${height - Math.max(0, item.value) / max * (height - 8)}`).join(' ')
  return <Card className="amafh-chart" role="group" aria-label={title}><h3 className="amafh-h4">{title}</h3>{data.length ? <><svg className="amafh-chart__line" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="var(--amafh-color-chart-primary)" strokeWidth="3" points={points} />{data.map((item, index) => <circle key={item.label} cx={data.length === 1 ? width / 2 : index * width / (data.length - 1)} cy={height - Math.max(0, item.value) / max * (height - 8)} r="4" fill="var(--amafh-color-chart-primary)" />)}</svg><div className="amafh-chart__axis">{data.map(item => <span key={item.label}>{item.label}</span>)}</div></> : <p>No chart data available.</p>}<ChartData title={title} data={data} valueLabel={valueLabel} /></Card>
}

export interface DonutChartProps { title: string; data: ChartDatum[]; valueLabel?: (value: number) => string }
export function DonutChart({ title, data, valueLabel = value => String(value) }: DonutChartProps) {
  const positive = data.map(item => ({ ...item, value: Math.max(0, item.value) }))
  const total = positive.reduce((sum, item) => sum + item.value, 0)
  const colors = ['primary', 'secondary', 'tertiary', 'positive', 'warning', 'negative']
  let offset = 0
  return <Card className="amafh-chart" role="group" aria-label={title}><h3 className="amafh-h4">{title}</h3>{total > 0 ? <><div className="amafh-chart__donut-wrap"><svg viewBox="0 0 100 100" className="amafh-chart__donut" aria-hidden="true"><circle cx="50" cy="50" r="38" fill="none" stroke="var(--amafh-color-chart-grid)" strokeWidth="14" />{positive.map((item, index) => { const fraction = item.value / total; const start = offset; offset += fraction; return <circle key={item.label} cx="50" cy="50" r="38" fill="none" stroke={`var(--amafh-color-chart-${colors[index % colors.length]})`} strokeWidth="14" strokeDasharray={`${fraction * 238.76} ${238.76 - fraction * 238.76}`} strokeDashoffset={-start * 238.76} transform="rotate(-90 50 50)" /> })}</svg><strong>{valueLabel(total)}</strong></div><ul className="amafh-chart__legend">{positive.map((item, index) => <li key={item.label}><span className={`amafh-chart__legend-swatch amafh-chart__legend-swatch--${colors[index % colors.length]}`} aria-hidden="true" />{item.label}<strong>{valueLabel(item.value)}</strong></li>)}</ul></> : <p>No chart data available.</p>}<ChartData title={title} data={data} valueLabel={valueLabel} /></Card>
}

function ChartData({ title, data, valueLabel }: { title: string; data: ChartDatum[]; valueLabel: (value: number) => string }) { return data.length > 0 && <table className="amafh-sr-only"><caption>{title} data</caption><thead><tr><th scope="col">Category</th><th scope="col">Value</th></tr></thead><tbody>{data.map(item => <tr key={item.label}><th scope="row">{item.label}</th><td>{valueLabel(item.value)}</td></tr>)}</tbody></table> }
