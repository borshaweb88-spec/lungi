export default {
  async scheduled(controller, env, ctx) {
    // 18:00 UTC is 00:00 the next day in Bangladesh. Save the completed Dhaka day.
    const dhakaDate = new Date(controller.scheduledTime + 6 * 60 * 60_000).toISOString().slice(0, 10);
    const reportDay = new Date(Date.parse(`${dhakaDate}T00:00:00Z`) - 24 * 60 * 60_000).toISOString().slice(0, 10);
    const site = String(env.REPORTS_SITE_URL || '').replace(/\/$/, '');
    if (!site || !env.DAILY_REPORT_CRON_SECRET) throw new Error('Set REPORTS_SITE_URL and DAILY_REPORT_CRON_SECRET on the report Worker.');
    ctx.waitUntil(fetch(`${site}/api/cron/daily-report`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Daily-Report-Token': env.DAILY_REPORT_CRON_SECRET },
      body: JSON.stringify({ day: reportDay }),
    }).then(async response => {
      if (!response.ok) throw new Error(`Daily report endpoint returned ${response.status}: ${await response.text()}`);
      const result = await response.json();
      console.log(`Saved daily sheet for ${reportDay}: ${result.summary.order_count} orders, ${result.summary.new_customer_accounts} new accounts`);
    }));
  },
  async fetch() {
    return new Response('Daily report scheduler is active.', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  },
};
