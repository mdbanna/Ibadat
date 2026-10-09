import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from './Feedback'

export interface Column<Row> {
  key: string
  header: string
  cell: (row: Row) => ReactNode
  align?: 'start' | 'end'
}

interface Props<Row> {
  caption: string
  columns: Column<Row>[]
  rows: Row[]
  rowKey: (row: Row) => string
  emptyTitle?: string
}

/** Table from 768px up; below that every row becomes a labelled card so nothing scrolls sideways on a 360px phone. */
export function DataTable<Row>({ caption, columns, rows, rowKey, emptyTitle }: Props<Row>) {
  const { t } = useTranslation()
  if (rows.length === 0) return <EmptyState title={emptyTitle} />
  return (
    <>
      <div className="hidden overflow-x-auto rounded-(--radius-card) border border-line bg-surface md:block" tabIndex={0} role="region" aria-label={caption}>
        <table className="w-full border-collapse text-start">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-forest-soft text-sm text-forest-deep">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={`px-4 py-3 font-semibold ${c.align === 'end' ? 'text-end' : 'text-start'}`}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-background">
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 align-middle ${c.align === 'end' ? 'text-end tabular-nums' : ''}`}>{c.cell(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-3 md:hidden" aria-label={`${caption} (${t('table.caption')})`}>
        {rows.map((row) => (
          <li key={rowKey(row)} className="rounded-(--radius-card) border border-line bg-surface p-4 shadow-(--shadow-card)">
            <dl className="grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-4 gap-y-2">
              {columns.map((c) => (
                <div key={c.key} className="contents">
                  <dt className="text-sm text-muted">{c.header}</dt>
                  <dd className={`min-w-0 break-words font-medium ${c.align === 'end' ? 'tabular-nums' : ''}`}>{c.cell(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  )
}
