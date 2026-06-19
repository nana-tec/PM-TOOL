import Layout from '@/layouts/MainLayout';
import { usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import dayjs from 'dayjs';
import printJS from 'print-js';

const ExportPdf = () => {
  const { project, tasks, stats } = usePage().props;

  useEffect(() => {
    const completedRows = tasks
      .filter(t => t.status === 'Completed')
      .map(
        t => `
      <tr>
        <td style="padding:6px 10px;border:1px solid #dee2e6;font-size:12px;">${t.number}</td>
        <td style="padding:6px 10px;border:1px solid #dee2e6;font-size:12px;">${t.name}</td>
        <td style="padding:6px 10px;border:1px solid #dee2e6;font-size:12px;">${t.priority || '—'}</td>
        <td style="padding:6px 10px;border:1px solid #dee2e6;font-size:12px;">${t.assignee || '—'}</td>
        <td style="padding:6px 10px;border:1px solid #dee2e6;font-size:12px;">${t.group || '—'}</td>
        <td style="padding:6px 10px;border:1px solid #dee2e6;font-size:12px;">${t.due_on || '—'}</td>
        <td style="padding:6px 10px;border:1px solid #dee2e6;font-size:12px;">${t.completed_at}</td>
      </tr>`
      )
      .join('');

    const pendingRows = tasks
      .filter(t => t.status === 'Pending')
      .map(
        t => `
      <tr>
        <td style="padding:6px 10px;border:1px solid #dee2e6;font-size:12px;">${t.number}</td>
        <td style="padding:6px 10px;border:1px solid #dee2e6;font-size:12px;">${t.name}</td>
        <td style="padding:6px 10px;border:1px solid #dee2e6;font-size:12px;">${t.priority || '—'}</td>
        <td style="padding:6px 10px;border:1px solid #dee2e6;font-size:12px;">${t.assignee || '—'}</td>
        <td style="padding:6px 10px;border:1px solid #dee2e6;font-size:12px;">${t.group || '—'}</td>
        <td style="padding:6px 10px;border:1px solid #dee2e6;font-size:12px;">${t.due_on || '—'}</td>
        <td style="padding:6px 10px;border:1px solid #dee2e6;font-size:12px;">${t.labels}</td>
      </tr>`
      )
      .join('');

    const html = `<!DOCTYPE html>
<html>
<head><title>${project.name} - Tasks Report</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:40px;color:#212529;}
  h1{font-size:28px;margin:0 0 4px;}
  h2{font-size:18px;margin:24px 0 8px;color:#495057;}
  .sub{color:#868e96;font-size:14px;margin-bottom:24px;}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;}
  th{background:#f1f3f5;padding:6px 10px;border:1px solid #dee2e6;text-align:left;font-weight:600;font-size:10px;text-transform:uppercase;color:#495057;}
  .stats{display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap;}
  .stat{flex:1;min-width:100px;background:#f8f9fa;padding:10px 16px;border-radius:8px;}
  .stat-label{font-size:11px;color:#868e96;text-transform:uppercase;font-weight:600;}
  .stat-value{font-size:22px;font-weight:700;margin-top:2px;}
  .tag{display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;}
  .tag-green{background:#d3f9d8;color:#2b8a3e;}
  .tag-orange{background:#fff3bf;color:#e67700;}
  @media print{body{padding:20px;}}
</style></head>
<body>
  <h1>${project.name}</h1>
  <div class="sub">
    ${project.client_company?.name ? `${project.client_company.name} &middot; ` : ''}
    Generated ${dayjs().format('MMMM D, YYYY')}
  </div>
  ${project.description ? `<p style="color:#495057;margin-bottom:20px;">${project.description}</p>` : ''}
  <div class="stats">
    <div class="stat">
      <div class="stat-label">Total Tasks</div>
      <div class="stat-value">${stats.total}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Completed</div>
      <div class="stat-value" style="color:#2f9e44;">${stats.completed}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Pending</div>
      <div class="stat-value" style="color:#e67700;">${stats.pending}</div>
    </div>
  </div>
  ${completedRows ? `
  <h2>Completed Tasks (${stats.completed})</h2>
  <table>
    <thead><tr>
      <th>ID</th><th>Name</th><th>Priority</th><th>Assignee</th><th>Group</th><th>Due Date</th><th>Completed At</th>
    </tr></thead>
    <tbody>${completedRows}</tbody>
  </table>` : ''}
  ${pendingRows ? `
  <h2>Pending Tasks (${stats.pending})</h2>
  <table>
    <thead><tr>
      <th>ID</th><th>Name</th><th>Priority</th><th>Assignee</th><th>Group</th><th>Due Date</th><th>Labels</th>
    </tr></thead>
    <tbody>${pendingRows}</tbody>
  </table>` : ''}
</body></html>`;

    printJS({
      printable: html,
      type: 'raw-html',
      documentTitle: `${project.name}-Tasks-${dayjs().format('YYYY-MM-DD')}`,
    });
  }, []);

  return null;
};

ExportPdf.layout = page => <Layout title='Export PDF'>{page}</Layout>;

export default ExportPdf;
