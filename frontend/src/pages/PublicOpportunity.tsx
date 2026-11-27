import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, BriefcaseBusiness, CheckCircle2, Clock3, MapPin } from 'lucide-react';
import PhoneField from '../components/people/PhoneField';
import { useToast } from '../components/projects/Toast';
import { peopleApi, type PeopleOpportunity } from '../services/peopleApi';

const emptyApplication = {
  fullName: '',
  email: '',
  phone: '',
  message: '',
  college: '',
  degree: '',
  skills: '',
  experienceYears: '',
};

export default function PublicOpportunityPage() {
  const { slug = '' } = useParams();
  const toast = useToast();
  const [opportunity, setOpportunity] = useState<Omit<PeopleOpportunity, 'id' | 'status'> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyApplication);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [applicationError, setApplicationError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void peopleApi.getPublicOpportunity(slug)
      .then(result => { if (active) setOpportunity(result); })
      .catch(loadError => { if (active) setError(loadError instanceof Error ? loadError.message : 'This opportunity is unavailable.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setApplicationError('');
    if (!form.fullName.trim()) { setApplicationError('Enter your full name.'); return; }
    if (!form.email.trim()) { setApplicationError('Enter your email address.'); return; }
    if (!form.phone) { setApplicationError('Enter a valid phone number.'); return; }
    setSaving(true);
    try {
      await peopleApi.applyToPublicOpportunity(slug, {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone,
        message: form.message.trim(),
        college: form.college.trim(),
        degree: form.degree.trim(),
        skills: form.skills.split(',').map(skill => skill.trim()).filter(Boolean),
        experienceYears: form.experienceYears ? Number(form.experienceYears) : 0,
      });
      setSubmitted(true);
      toast.success('Your application has been successfully submitted.');
      setForm(emptyApplication);
    } catch (submitError) {
      setApplicationError(submitError instanceof Error ? submitError.message : 'Your application could not be submitted. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-[#f5f7f5] p-6"><p role="status" className="text-sm text-slate-500">Loading opportunity…</p></main>;
  }

  if (error || !opportunity) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f7f5] p-6">
        <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-amber-700"><Clock3 size={22} /></div>
          <h1 className="mt-4 text-xl font-black text-slate-900">Opportunity unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">{error || 'This opportunity is no longer available.'}</p>
          <Link to="/" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-teal-700 hover:underline"><ArrowLeft size={15} /> Return to site</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7f5] text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-slate-900"><span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-800 text-white"><BriefcaseBusiness size={16} /></span> Hope Foundation</Link>
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-800">Careers & Opportunities</span>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.7fr)] lg:py-16">
        <section>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-800">{opportunity.opportunityType} opportunity</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-black leading-tight tracking-tight text-slate-950 md:text-5xl">{opportunity.title}</h1>
          <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-600">
            {opportunity.location && <span className="inline-flex items-center gap-1.5"><MapPin size={15} />{opportunity.location}</span>}
            {opportunity.employmentType && <span className="rounded-full bg-teal-50 px-3 py-1 font-semibold text-teal-900">{opportunity.employmentType}</span>}
            {opportunity.closesOn && <span className="rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-900">Apply by {opportunity.closesOn}</span>}
          </div>
          <div className="mt-9 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <h2 className="text-lg font-extrabold text-slate-900">About this opportunity</h2>
            <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-slate-600">{opportunity.description}</p>
            {opportunity.requirements && <><h3 className="mt-8 text-base font-extrabold text-slate-900">What we’re looking for</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{opportunity.requirements}</p></>}
          </div>
          <p className="mt-5 text-xs leading-5 text-slate-500">Your application will be reviewed by Hope Foundation’s People team. Your details are shared only for recruitment and opportunity coordination.</p>
        </section>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_16px_50px_-36px_rgba(15,23,42,0.45)] md:p-7 lg:sticky lg:top-8">
          {submitted ? (
            <div className="py-8 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-700"><CheckCircle2 size={24} /></div>
              <h2 className="mt-4 text-xl font-black text-slate-900">Application received</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Thank you for your interest. The People team will review your submission.</p>
            </div>
          ) : (
            <>
              <div className="mb-5"><p className="text-xs font-bold uppercase tracking-[0.15em] text-teal-800">Take the next step</p><h2 className="mt-2 text-2xl font-black text-slate-900">Apply now</h2><p className="mt-1 text-sm text-slate-500">Fields marked <span className="text-rose-600">*</span> are required.</p></div>
              {applicationError && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{applicationError}</p>}
              <form className="flex flex-col gap-4" onSubmit={event => void submit(event)}>
                <label className="text-xs font-semibold text-slate-700">Full name <span className="text-rose-600">*</span><input className="form-input mt-1" required minLength={2} maxLength={120} value={form.fullName} onChange={event => setForm(current => ({ ...current, fullName: event.target.value }))} autoComplete="name" /></label>
                <label className="text-xs font-semibold text-slate-700">Email address <span className="text-rose-600">*</span><input className="form-input mt-1" required type="email" maxLength={254} value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} autoComplete="email" /></label>
                <PhoneField label="Phone number" value={form.phone} required onChange={phone => setForm(current => ({ ...current, phone }))} />
                {opportunity.opportunityType === 'Internship' && <>
                  <label className="text-xs font-semibold text-slate-700">College / university<input className="form-input mt-1" maxLength={200} value={form.college} onChange={event => setForm(current => ({ ...current, college: event.target.value }))} /></label>
                  <label className="text-xs font-semibold text-slate-700">Degree / course<input className="form-input mt-1" maxLength={200} value={form.degree} onChange={event => setForm(current => ({ ...current, degree: event.target.value }))} /></label>
                </>}
                {opportunity.opportunityType === 'Job' && <>
                  <label className="text-xs font-semibold text-slate-700">Qualification<input className="form-input mt-1" maxLength={200} value={form.degree} onChange={event => setForm(current => ({ ...current, degree: event.target.value }))} /></label>
                  <label className="text-xs font-semibold text-slate-700">Years of experience<input className="form-input mt-1" type="number" min="0" max="80" step="0.5" value={form.experienceYears} onChange={event => setForm(current => ({ ...current, experienceYears: event.target.value }))} /></label>
                </>}
                <label className="text-xs font-semibold text-slate-700">Skills, comma separated<input className="form-input mt-1" maxLength={1000} value={form.skills} onChange={event => setForm(current => ({ ...current, skills: event.target.value }))} placeholder="e.g. outreach, research, communications" /></label>
                <label className="text-xs font-semibold text-slate-700">{opportunity.opportunityType === 'Volunteer' ? 'Why would you like to volunteer?' : 'Message'}<textarea className="form-input mt-1 min-h-24" maxLength={5000} value={form.message} onChange={event => setForm(current => ({ ...current, message: event.target.value }))} /></label>
                <button className="btn-primary mt-1 inline-flex items-center justify-center gap-2 !py-3" type="submit" disabled={saving}>{saving ? 'Submitting…' : 'Submit application'} {!saving && <ArrowUpRight size={16} />}</button>
              </form>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
