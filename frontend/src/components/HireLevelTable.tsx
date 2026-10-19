import { hireLevelRows } from '../data/mockData'

export default function HireLevelTable() {
  return (
    <section aria-labelledby="hire-level-title" className="hire-level">
      <h2 className="section-heading" id="hire-level-title">
        By hire level
      </h2>
      <div className="hire-level__rule" />
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Hire level</th>
              <th scope="col">Cycle</th>
              <th scope="col">Due</th>
              <th scope="col">Overdue</th>
              <th scope="col">Outstanding observations</th>
            </tr>
          </thead>
          <tbody>
            {hireLevelRows.map((row) => (
              <tr key={row.hireLevel}>
                <th scope="row">{row.hireLevel}</th>
                <td>{row.cycle}</td>
                <td>{row.due}</td>
                <td className="table-overdue">{row.overdue}</td>
                <td>{row.outstanding}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
