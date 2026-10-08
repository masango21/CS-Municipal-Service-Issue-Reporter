import Link from "next/link";
import { InformationPage } from "@/components/InformationPage";

const questionClass = "group py-5 first:pt-0 last:pb-0";
const answerClass = "mt-3 max-w-3xl text-sm leading-6 text-slate-600";

export default function HelpPage() {
  return (
    <InformationPage
      title="Help / FAQ"
      intro="Find answers about resident accounts, submitting a municipal issue, and following reports. This project is not confirmed as an official or live municipal reporting channel."
    >
      <section className="py-8" aria-labelledby="about-help">
        <h2 id="about-help" className="mb-5 text-xl font-bold text-slate-900">About the service</h2>
        <details className={questionClass}>
          <summary className="cursor-pointer list-inside list-disc font-semibold text-slate-800 marker:text-emerald-700">What does this system do?</summary>
          <p className={answerClass}>Residents can submit municipal service issue reports with a map location. Municipal staff can review and triage those reports. The public map and issue feed show submitted reports; a new instance starts with no reports or map pins.</p>
        </details>
        <details className={questionClass}>
          <summary className="cursor-pointer list-inside list-disc font-semibold text-slate-800 marker:text-emerald-700">Is this an official municipal service?</summary>
          <p className={answerClass}>The project information does not identify an operating municipality or confirm a live official service. For urgent issues or to make sure a municipality receives a report, use that municipality&apos;s verified contact channels as well.</p>
        </details>
      </section>

      <section className="py-8" aria-labelledby="account-help">
        <h2 id="account-help" className="mb-5 text-xl font-bold text-slate-900">Accounts</h2>
        <details className={questionClass}>
          <summary className="cursor-pointer list-inside list-disc font-semibold text-slate-800 marker:text-emerald-700">How do I create a resident account?</summary>
          <p className={answerClass}>Choose Register and provide your name, email address, and a password. A phone number is optional. Staff accounts use a separate, invitation-controlled registration process.</p>
        </details>
        <details className={questionClass}>
          <summary className="cursor-pointer list-inside list-disc font-semibold text-slate-800 marker:text-emerald-700">I forgot my password. How can I reset it?</summary>
          <p className={answerClass}>Password recovery and email verification are not available in this build. Contact <Link href="/contact" className="font-medium text-emerald-700 underline underline-offset-2">support</Link> using the details to be confirmed there. Do not send your password.</p>
        </details>
        <details className={questionClass}>
          <summary className="cursor-pointer list-inside list-disc font-semibold text-slate-800 marker:text-emerald-700">Can I edit my profile or delete my account?</summary>
          <p className={answerClass}>There is no profile editing or account deletion workflow in the current application. A verified contact and account-request process have not been provided yet.</p>
        </details>
      </section>

      <section className="py-8" aria-labelledby="report-help">
        <h2 id="report-help" className="mb-5 text-xl font-bold text-slate-900">Reporting an issue</h2>
        <details className={questionClass}>
          <summary className="cursor-pointer list-inside list-disc font-semibold text-slate-800 marker:text-emerald-700">How do I submit a report?</summary>
          <p className={answerClass}>Sign in as a resident, open Report an Issue, complete the title and description, choose a category and priority, and select the issue&apos;s location on the map. The system resolves the municipality from the selected coordinates. You may attach one JPEG, PNG, or WebP evidence image up to 3 MB. Review the details before submitting; residents cannot edit or delete reports after submission in this build.</p>
        </details>
        <details className={questionClass}>
          <summary className="cursor-pointer list-inside list-disc font-semibold text-slate-800 marker:text-emerald-700">How do I choose the location?</summary>
          <p className={answerClass}>Search for a South African place, use your device location if you allow the browser to access it, or select the point directly on the map. The municipality must be resolved for the report to be submitted. If resolution fails, adjust the pin and try again.</p>
        </details>
        <details className={questionClass}>
          <summary className="cursor-pointer list-inside list-disc font-semibold text-slate-800 marker:text-emerald-700">What if my evidence image is rejected?</summary>
          <p className={answerClass}>Use a JPEG, PNG, or WebP image no larger than 3 MB. The current application does not accept other file types for report evidence.</p>
        </details>
      </section>

      <section className="py-8" aria-labelledby="finding-help">
        <h2 id="finding-help" className="mb-5 text-xl font-bold text-slate-900">Finding and following reports</h2>
        <details className={questionClass}>
          <summary className="cursor-pointer list-inside list-disc font-semibold text-slate-800 marker:text-emerald-700">Where can I find reports?</summary>
          <p className={answerClass}>Use Map / Issues to browse the public report feed and map. The feed can be searched and filtered by report text, category, and status. After signing in, My Reports shows reports associated with your resident account.</p>
        </details>
        <details className={questionClass}>
          <summary className="cursor-pointer list-inside list-disc font-semibold text-slate-800 marker:text-emerald-700">Will I get an email or push notification?</summary>
          <p className={answerClass}>Email and push notifications are not implemented. Municipal updates posted to a report can be viewed on that report&apos;s details page; check the page for the latest status and updates.</p>
        </details>
        <details className={questionClass}>
          <summary className="cursor-pointer list-inside list-disc font-semibold text-slate-800 marker:text-emerald-700">Can I see private staff notes or another resident&apos;s account details?</summary>
          <p className={answerClass}>No. Public report responses omit reporter identity and staff-only notes and assignment information. Residents can access their own reports when signed in; staff tools are restricted by role and municipality access.</p>
        </details>
      </section>

      <section className="py-8" aria-labelledby="troubleshooting-help">
        <h2 id="troubleshooting-help" className="mb-5 text-xl font-bold text-slate-900">Troubleshooting and support</h2>
        <details className={questionClass}>
          <summary className="cursor-pointer list-inside list-disc font-semibold text-slate-800 marker:text-emerald-700">The map cannot find my location or municipality. What should I do?</summary>
          <p className={answerClass}>Check your internet connection. If you used device location, allow location access in your browser settings; you can also search for a place or move the pin manually. Try another nearby point if the municipality cannot be resolved. Map search and geocoding depend on external services and may be temporarily unavailable.</p>
        </details>
        <details className={questionClass}>
          <summary className="cursor-pointer list-inside list-disc font-semibold text-slate-800 marker:text-emerald-700">How do I contact support?</summary>
          <p className={answerClass}>See the <Link href="/contact" className="font-medium text-emerald-700 underline underline-offset-2">Contact page</Link>. Contact details and support hours still need to be confirmed: [SUPPORT EMAIL] and [EXPECTED RESPONSE TIME].</p>
        </details>
      </section>
    </InformationPage>
  );
}