import { InformationPage } from "@/components/InformationPage";

export default function ContactPage() {
  return (
    <InformationPage
      title="Contact"
      intro="Contact support about account access, report submission, map-location problems, or questions about a report. The project does not currently provide a verified support channel or contact form."
    >
      <section className="py-8" aria-labelledby="contact-details">
        <h2 id="contact-details" className="text-xl font-bold text-slate-900">Support details</h2>
        <dl className="mt-5 grid gap-x-8 gap-y-5 border-y border-slate-200 py-6 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-semibold text-slate-800">Email</dt>
            <dd className="mt-1 text-sm text-slate-600">[SUPPORT EMAIL]</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-800">Phone</dt>
            <dd className="mt-1 text-sm text-slate-600">[SUPPORT PHONE]</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-800">Physical address</dt>
            <dd className="mt-1 text-sm text-slate-600">[PHYSICAL ADDRESS]</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-800">Support hours</dt>
            <dd className="mt-1 text-sm text-slate-600">[SUPPORT HOURS]</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-800">Expected response time</dt>
            <dd className="mt-1 text-sm text-slate-600">[EXPECTED RESPONSE TIME]</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-800">Website</dt>
            <dd className="mt-1 text-sm text-slate-600">[WEBSITE]</dd>
          </div>
        </dl>
        <p className="mt-5 max-w-3xl text-sm leading-6 text-slate-600">These placeholders must be replaced with verified details before this page is used to direct support requests. No contact form, support email integration, or social contact link is configured in the application.</p>
      </section>
    </InformationPage>
  );
}