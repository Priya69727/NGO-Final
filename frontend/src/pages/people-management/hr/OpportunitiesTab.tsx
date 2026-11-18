import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Copy, ExternalLink, Plus, Share2 } from 'lucide-react';
import { Modal, SelectField, StatusBadge, TextAreaField, TextField } from '../../../components/people';
import { peopleApi, type Department, type PeopleOpportunity } from '../../../services/peopleApi';

const blankOpportunity = {
  opportunityType: 'Job' as PeopleOpportunity['opportunityType'],
  title: '',
  description: '',
  requirements: '',
  departmentId: '',
  location: '',
  employmentType: '',
  closesOn: '',
  status: 'Draft' as PeopleOpportunity['status'],
};

function publicUrl(slug: string) {
  return `${window.location.origin}/opportunities/${slug}`;
}

export default function OpportunitiesTab({ departments }: { departments: Department[] }) {
  const [opportunities, setOpportunities] = useState<PeopleOpportunity[]>([]);
  const [form, setForm] = useState(blankOpportunity);
  const [editing, setEditing] = useState<PeopleOpportunity | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await peopleApi.getPeopleOpportunities();
      setOpportunities(response.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load opportunities.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setError('');
    if (!form.title.trim()) { setError('Opportunity title is required.'); return; }
    if (!form.description.trim()) { setError('Opportunity description is required.'); return; }
    if (form.closesOn && form.status === 'Published' && form.closesOn < new Date().toISOString().slice(0, 10)) {
      setError('A published opportunity must have a future application deadline.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        departmentId: form.departmentId || undefined,
        closesOn: form.closesOn || undefined,
      };
      const created = editing
        ? await peopleApi.updatePeopleOpportunity(editing.id, payload)
        : await peopleApi.createPeopleOpportunity(payload);
      setModalOpen(false);
      setEditing(null);
      setForm(blankOpportunity);
      setNotice(created.status === 'Published' ? `Published. Share ${publicUrl(created.slug)} with candidates.` : 'Opportunity saved.');
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to save opportunity.');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (item: PeopleOpportunity, status: 'Published' | 'Closed' | 'Draft') => {
    setError('');
    try {
      const updated = await peopleApi.updatePeopleOpportunity(item.id, { status });
      setNotice(status === 'Published' ? `Opportunity published: ${publicUrl(updated.slug)}` : `Opportunity ${status.toLowerCase()}.`);
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update opportunity.');
    }
  };

  const copyLink = async (item: PeopleOpportunity) => {
    try {
      await navigator.clipboard.writeText(publicUrl(item.slug));
      setNotice('Public application link copied.');
    } catch {
      setError('The link could not be copied. Select and copy the URL manually.');
    }
  };

  const share = async (item: PeopleOpportunity) => {
    if (!navigator.share) {
      await copyLink(item);
      return;
    }
    try {
      await navigator.share({ title: item.title, text: `Apply for ${item.title}`, url: publicUrl(item.slug) });
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') return;
      setError('Unable to share this opportunity from the current browser.');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-sm text-slate-500">Share public application pages without exposing internal HR records.</p><h2 className="mt-1 text-xl font-black text-slate-900">Job & opportunity board</h2></div>
        <button className="btn-primary flex items-center gap-2" onClick={() => { setError(''); setEditing(null); setForm(blankOpportunity); setModalOpen(true); }}><Plus size={16} /> New opportunity</button>
      </div>
      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}
      {loading ? <div role="status" className="card p-8 text-center text-sm text-slate-500">Loading opportunities…</div> : opportunities.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {opportunities.map(item => (
            <article key={item.id} className="card flex flex-col gap-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-teal-800">{item.opportunityType}</span><StatusBadge status={item.status} /></div><h3 className="mt-2 text-lg font-extrabold text-slate-900">{item.title}</h3></div>
                <span className="text-xs text-slate-500">{item.closesOn ? `Closes ${item.closesOn}` : 'No deadline'}</span>
              </div>
              <p className="line-clamp-3 text-sm leading-5 text-slate-600">{item.description}</p>
              <div className="flex flex-wrap gap-2 text-xs text-slate-500">{item.location && <span>{item.location}</span>}{item.employmentType && <span>· {item.employmentType}</span>}{item.departmentId && <span>· {departments.find(department => department.id === item.departmentId)?.name ?? 'Department'}</span>}</div>
              {item.status === 'Published' && <label className="block text-[11px] font-semibold text-slate-500">Public application URL<input className="form-input mt-1 text-xs" readOnly value={publicUrl(item.slug)} onFocus={event => event.currentTarget.select()} /></label>}
              <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                <button className="btn-secondary !py-1.5 !text-xs" onClick={() => {
                  setEditing(item);
                  setForm({
                    opportunityType: item.opportunityType,
                    title: item.title,
                    description: item.description,
                    requirements: item.requirements,
                    departmentId: item.departmentId ?? '',
                    location: item.location,
                    employmentType: item.employmentType,
                    closesOn: item.closesOn ?? '',
                    status: item.status === 'Expired' ? 'Closed' : item.status,
                  });
                  setError('');
                  setModalOpen(true);
                }}>Edit details</button>
                {item.status === 'Draft' || item.status === 'Closed' ? <button className="btn-primary !py-1.5 !text-xs" onClick={() => void setStatus(item, 'Published')}><ArrowUpRight size={14} /> Publish</button> : <button className="btn-secondary !py-1.5 !text-xs" onClick={() => void setStatus(item, 'Closed')}>Close applications</button>}
                {item.status === 'Published' && <><button className="btn-secondary !py-1.5 !text-xs" onClick={() => void copyLink(item)}><Copy size={13} /> Copy link</button><button className="btn-secondary !py-1.5 !text-xs" onClick={() => void share(item)}><Share2 size={13} /> Share</button><a className="btn-secondary !py-1.5 !text-xs" href={publicUrl(item.slug)} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Preview</a></>}
              </div>
            </article>
          ))}
        </div>
      ) : <div className="card p-10 text-center"><p className="text-sm font-bold text-slate-700">No opportunities yet</p><p className="mt-1 text-xs text-slate-500">Create a job, internship, or volunteer opportunity to generate a public application link.</p></div>}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit opportunity' : 'Create an opportunity'} submitLabel={saving ? 'Saving…' : !editing && form.status === 'Published' ? 'Publish opportunity' : 'Save changes'} onSubmit={save} wide>
        {error && <div className="col-span-full rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</div>}
        <SelectField label="Opportunity type" required value={form.opportunityType} onChange={value => setForm(current => ({ ...current, opportunityType: value as PeopleOpportunity['opportunityType'] }))} options={['Job', 'Internship', 'Volunteer']} />
        <SelectField label="Publication status" required value={form.status} onChange={value => setForm(current => ({ ...current, status: value as PeopleOpportunity['status'] }))} options={['Draft', 'Published']} />
        <TextField label="Title" required value={form.title} onChange={title => setForm(current => ({ ...current, title }))} placeholder="e.g. Community Outreach Intern" />
        <TextField label="Location" value={form.location} onChange={location => setForm(current => ({ ...current, location }))} placeholder="City or remote" />
        <SelectField label="Department" value={form.departmentId} onChange={departmentId => setForm(current => ({ ...current, departmentId }))} options={[{ label: 'No department', value: '' }, ...departments.map(department => ({ label: department.name, value: department.id }))]} />
        <TextField label="Work arrangement" value={form.employmentType} onChange={employmentType => setForm(current => ({ ...current, employmentType }))} placeholder="Full-time, internship, flexible…" />
        <TextField label="Application deadline" type="date" value={form.closesOn} onChange={closesOn => setForm(current => ({ ...current, closesOn }))} />
        <TextAreaField label="Description" required value={form.description} onChange={description => setForm(current => ({ ...current, description }))} placeholder="Describe the work, impact, and candidate profile." />
        <TextAreaField label="Requirements" value={form.requirements} onChange={requirements => setForm(current => ({ ...current, requirements }))} placeholder="Skills, qualifications, or availability expected." />
      </Modal>
    </div>
  );
}
