import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowRight, Camera, Check, ChevronRight, Clock3, ImagePlus, LoaderCircle, LogOut, NotebookPen, Plus, RefreshCw, Settings, Soup, X } from 'lucide-react';
import { useAuth } from '../features/auth/AuthProvider';
import { client, errorMessage } from '../lib/supabase';
import { compressImage } from '../lib/image';
import { enqueue, flushQueue, pendingFor } from '../lib/offlineQueue';
import { listVisits, sendDraft } from '../features/visits/api';
import type { PendingDraft, Visit } from '../types/domain';

const date = (value: string) => new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const localDate = () => { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
function Notice({ children }: { children: ReactNode }) { return <p className="notice" role="status">{children}</p>; }
function Bowl({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 300 220" fill="none" aria-hidden="true"><ellipse cx="150" cy="194" rx="99" ry="9" fill="currentColor" opacity=".07"/><g stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M53 110h194c-8 50-41 76-97 76s-89-26-97-76Z"/><ellipse cx="150" cy="110" rx="97" ry="22"/><path d="M111 186v8h78v-8M81 135c8 20 24 32 46 37M108 67c-18-20 16-25 0-44m41 44c-18-20 16-25 0-44m41 44c-18-20 16-25 0-44M161 94l108-52M171 100l101-42"/><path d="M83 110c19-19 31 14 51-3s29 15 49 0"/></g></svg>;
}
function Login() {
  const auth = useAuth(); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  if (auth.member || auth.preview) return <Navigate to="/visits" replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true); setError('');
    try { const { error } = await client().auth.signInWithPassword({ email: String(data.get('email')), password: String(data.get('password')) }); if (error) throw error; }
    catch { setError('ログインできませんでした。メールアドレス・パスワードと通信状況をご確認ください。'); }
    finally { setBusy(false); }
  }
  return <div className="login-page"><div className="login-art"><span className="eyebrow">YOUR PERSONAL RAMEN JOURNAL</span><Bowl /><h1>一杯を、<br/>自分の記録に。</h1><p>今日の一杯が、次の「ちょうどいい」につながる。</p></div><div className="login-form"><span className="brand"><Soup/> Jirō Log<span className="brand-dot">.</span></span><h2>おかえりなさい。</h2><p className="muted">招待されたアカウントでログインしてください。</p><form onSubmit={submit}><label>メールアドレス<input name="email" type="email" autoComplete="username" required /></label><label>パスワード<input name="password" type="password" autoComplete="current-password" required /></label>{(error || auth.error) && <Notice>{error || auth.error}</Notice>}<button className="button primary" disabled={busy}>{busy ? 'ログイン中…' : 'ログイン'}<ArrowRight size={18}/></button></form><p className="fine-print">身内のための、小さなラーメン手帳。</p></div></div>;
}
function Photo({ path }: { path: string }) {
  const [url, setUrl] = useState(''); const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true; let objectUrl = ''; setUrl(''); setFailed(false);
    // Authenticated downloads avoid retaining signed URLs after account changes.
    client().storage.from('jiro-photos').download(path).then(({ data, error }) => {
      if (!active) return;
      if (error || !data) { setFailed(true); return; }
      objectUrl = URL.createObjectURL(data); setUrl(objectUrl);
    });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path]);
  return url ? <img className="visit-photo" src={url} alt="記録した一杯"/> : <div className="photo-placeholder"><Soup/><span>{failed ? '写真を取得できませんでした' : '写真を読み込み中…'}</span></div>;
}
export function App() {
  const auth = useAuth();
  if (auth.loading) return <div className="loading"><LoaderCircle className="spin"/>読み込み中…</div>;
  if (!auth.member && !auth.preview) return <Routes><Route path="/login" element={<Login/>}/><Route path="*" element={<Navigate to="/login" replace/>}/></Routes>;
  return <Workspace key={auth.member?.user_id ?? 'preview'}/>;
}
function Workspace() {
  const auth = useAuth(); const [visits, setVisits] = useState<Visit[]>([]); const [pending, setPending] = useState<PendingDraft[]>([]); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const refresh = useCallback(async () => {
    if (!auth.member) return;
    setBusy(true); setError('');
    try { const [rows, queue] = await Promise.all([listVisits(), pendingFor(auth.member.user_id)]); if (alive.current) { setVisits(rows); setPending(queue); } }
    catch (e) { if (alive.current) setError(errorMessage(e)); }
    finally { if (alive.current) setBusy(false); }
  }, [auth.member]);
  const retry = useCallback(async () => {
    if (!auth.member) return;
    setBusy(true); setError('');
    try { await flushQueue(auth.member.user_id, sendDraft); await refresh(); }
    catch (e) { if (alive.current) { setError(`未送信の記録を保持しています。${errorMessage(e)}`); setPending(await pendingFor(auth.member.user_id)); } }
    finally { if (alive.current) setBusy(false); }
  }, [auth.member, refresh]);
  useEffect(() => { void refresh(); void retry(); window.addEventListener('online', retry); const visible = () => { if (document.visibilityState === 'visible') void retry(); }; document.addEventListener('visibilitychange', visible); return () => { window.removeEventListener('online', retry); document.removeEventListener('visibilitychange', visible); }; }, [refresh, retry]);
  return <div className="app-shell"><aside className="sidebar"><Link className="brand" to="/visits"><Soup/>Jirō Log<span className="brand-dot">.</span></Link><p className="sidebar-caption">一杯を、自分の記録に。</p><div className="nav-label">MY JOURNAL</div><nav><NavLink to="/visits" end><NotebookPen size={19}/>一杯の記録</NavLink><NavLink to="/visits/new"><Plus size={19}/>記録をつける</NavLink><NavLink to="/settings"><Settings size={19}/>設定</NavLink></nav><div className="sidebar-bottom"><Bowl/><p>おいしかった、を忘れない。</p><span>ONE BOWL AT A TIME.</span></div><div className="profile"><span className="avatar">{auth.preview ? 'J' : auth.member?.display_name.slice(0, 1)}</span><div>{auth.preview ? 'プレビュー' : auth.member?.display_name}<small>{auth.preview ? '画面をお試し中' : 'MEMBER’S JOURNAL'}</small></div></div></aside><div className="main-shell"><header className="topbar"><span className="topbar-title">THE RAMEN JOURNAL</span><span className="private-label"><span/>{auth.preview ? 'プレビューモード' : 'メンバー限定'}</span></header><main>{auth.preview && <div className="preview-banner">プレビューモード — 写真選択と画面をお試しできます。記録の保存にはSupabaseの設定が必要です。</div>}{error && <Notice>{error}</Notice>}<Routes><Route path="/visits" element={<Home visits={visits} pending={pending} busy={busy} retry={retry}/>}/><Route path="/visits/new" element={<NewVisit refresh={refresh}/>}/><Route path="/visits/:id" element={<Detail visits={visits} busy={busy} refresh={refresh}/>}/><Route path="/settings" element={<SettingsPage pendingCount={pending.length}/>}/><Route path="*" element={<Navigate to="/visits" replace/>}/></Routes></main><footer>Jirō Log <span>一杯ずつ、自分を知る。</span><span>EST. 2026</span></footer></div></div>;
}
function Home({ visits, pending, busy, retry }: { visits: Visit[]; pending: PendingDraft[]; busy: boolean; retry: () => Promise<void> }) {
  const [filter, setFilter] = useState('all'); const [query, setQuery] = useState('');
  const drafts = visits.filter(v => v.status === 'draft');
  const shown = visits.filter(v => (filter !== 'draft' || v.status === 'draft') && `${v.shopName ?? ''} ${v.note}`.toLowerCase().includes(query.toLowerCase()));
  return <><div className="page-heading"><div><span className="eyebrow">MY RAMEN JOURNAL</span><h1>一杯の記録<span className="heading-dot">.</span></h1><p>今日の一杯を残して、次の一杯をもっと自分好みに。</p></div><span className="edition">日々是、好麺。<br/><span>JIRO LOG / VOL. 01</span></span></div><section className="capture-card"><div className="capture-copy"><span className="pill"><span/> PHOTO FIRST</span><h2>まずは、写真だけで。</h2><p>コールも、感想も、あとで大丈夫。<br/>食べた一杯を、気軽に残しておこう。</p><Link className="button dark" to="/visits/new?camera=1"><Camera size={20}/>撮影して記録<ArrowRight size={18}/></Link><Link className="text-link" to="/visits/new">写真なしで記録する <ChevronRight size={15}/></Link></div><div className="capture-art"><div className="art-ring"/><Bowl/><span>A BOWL WORTH REMEMBERING</span></div></section><div className="stats"><div><span>記録した一杯</span><strong>{visits.length}<small>杯</small></strong></div><div><span>あとで書く</span><strong>{drafts.length}<small>件</small></strong></div><div><span>未送信</span><strong>{pending.length}<small>件</small></strong></div></div>{pending.length > 0 && <section className="pending-banner"><div><Clock3 size={19}/><span><strong>{pending.length}件の記録が未送信です</strong><small>この端末に退避しています。接続後に送信します。</small></span></div><button className="button secondary" onClick={retry} disabled={busy}><RefreshCw size={16}/>再送する</button></section>}<section className="journal-section"><div className="section-heading"><h2>最近の記録 <span>RECENT BOWLS</span></h2><button className="icon-button" aria-label="記録を更新" onClick={retry} disabled={busy}><RefreshCw size={17} className={busy ? 'spin' : ''}/></button></div><div className="filters"><div className="tabs"><button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>すべて<span>{visits.length}</span></button><button className={filter === 'draft' ? 'selected' : ''} onClick={() => setFilter('draft')}>下書き<span>{drafts.length}</span></button></div><input className="search" aria-label="店舗やメモで検索" placeholder="店舗・メモで検索" value={query} onChange={e => setQuery(e.target.value)}/></div>{shown.length ? <div className="visit-grid">{shown.map(visit => <Link className="visit-card" to={`/visits/${visit.id}`} key={visit.id}>{visit.photoPath ? <Photo path={visit.photoPath}/> : <div className="photo-placeholder"><Soup size={40}/></div>}<div className="visit-card-body"><span className="status-tag">{visit.status === 'draft' ? 'あとで書く' : '記録済み'}</span><h3>{visit.shopName || '店舗はあとで'}</h3><p>{date(visit.visitedAt)}</p>{visit.note && <p className="note-excerpt">{visit.note}</p>}</div></Link>)}</div> : <div className="empty-state"><span className="empty-icon"><NotebookPen size={26}/></span><h3>{query || filter === 'draft' ? '該当する記録はありません' : 'あなたの一杯目を、ここから。'}</h3><p>{query || filter === 'draft' ? '条件を変えると、ほかの記録を確認できます。' : '写真と日時だけで、立派な記録。\n自分だけのラーメン手帳をはじめましょう。'}</p>{!query && filter === 'all' && <Link to="/visits/new" className="text-link">最初の一杯を記録する <ArrowRight size={16}/></Link>}</div>}</section><section className="how-to"><span className="eyebrow">HOW TO JIRŌ LOG</span><div><span>01</span><p><strong>写真で残す</strong>まずは一杯を撮るだけ。</p><ArrowRight size={18}/><span>02</span><p><strong>あとで書き足す</strong>注文や気づきをメモ。</p><ArrowRight size={18}/><span>03</span><p><strong>次の一杯へ</strong>自分の「ちょうどいい」を探す。</p></div></section></>;
}
function NewVisit({ refresh }: { refresh: () => Promise<void> }) {
  const auth = useAuth(); const navigate = useNavigate(); const [photo, setPhoto] = useState<Awaited<ReturnType<typeof compressImage>> | null>(null); const [url, setUrl] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [saved, setSaved] = useState<{ id: string; queued: boolean } | null>(null); const [visitedAt, setVisitedAt] = useState(localDate); const [note, setNote] = useState(''); const draftRef = useRef<PendingDraft | null>(null);
  useEffect(() => { if (!photo) { setUrl(''); return; } const value = URL.createObjectURL(photo.blob); setUrl(value); return () => URL.revokeObjectURL(value); }, [photo]);
  async function select(file?: File) { if (!file) return; setBusy(true); setError(''); try { setPhoto(await compressImage(file)); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); } }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!auth.member) { setError('プレビューでは保存されません。Supabaseを設定すると記録を保存できます。'); return; }
    setBusy(true); setError('');
    try {
      const id = crypto.randomUUID(); const photoId = crypto.randomUUID();
      const draft: PendingDraft = draftRef.current ?? { id, ownerId: auth.member.user_id, visitedAt: new Date(visitedAt).toISOString(), note, photo: photo ? { id: photoId, blob: photo.blob, width: photo.width, height: photo.height, path: `${auth.member.user_id}/${id}/${photoId}.${photo.extension}` } : null };
      await enqueue(draft); draftRef.current = draft;
      let queued = false;
      try { await flushQueue(auth.member.user_id, sendDraft); queued = (await pendingFor(auth.member.user_id)).some(item => item.id === draft.id); } catch { queued = true; }
      await refresh(); setSaved({ id: draft.id, queued });
    } catch (e) { setError(`保存できませんでした。画面を閉じずに再度お試しください。${errorMessage(e)}`); }
    finally { setBusy(false); }
  }
  if (saved) return <div className="success-card"><span className="success-icon">{saved.queued ? <Clock3/> : <Check/>}</span><span className="eyebrow">{saved.queued ? 'WAITING TO SYNC' : 'NICE BOWL, SAVED.'}</span><h1>{saved.queued ? 'この端末に退避しました。' : '一杯、残せました。'}</h1><p>{saved.queued ? '未送信の記録は、接続後や次回起動時に再送します。送信が完了するまでブラウザのデータを削除しないでください。' : '詳しいことは、ひと息ついてから。\n今日の一杯を忘れないうちに、メモも残せます。'}</p>{!saved.queued && <button className="button primary" onClick={() => navigate(`/visits/${saved.id}`)}>メモを追記する<ArrowRight size={18}/></button>}<Link className="button secondary" to="/visits">あとで · 記録に戻る</Link></div>;
  return <div className="narrow"><Link to="/visits" className="back-link"><ArrowLeft size={16}/>一杯の記録</Link><span className="eyebrow">NEW BOWL</span><h1>今日の一杯を残す。</h1><p className="muted">写真だけでOK。詳細は、あとからゆっくり。</p><form onSubmit={save}><section className="form-card"><div className="section-heading"><h2>一杯の写真</h2><span className="optional">任意</span></div>{url ? <div className="selected-photo"><img src={url} alt="保存する写真のプレビュー"/><button type="button" className="icon-button" aria-label="選択した写真を取り消す" onClick={() => setPhoto(null)} disabled={busy}><X size={20}/></button></div> : <div className="photo-picker"><ImagePlus size={38}/><strong>おいしかった一杯を、1枚。</strong><span>長辺1600pxに縮小して保存します</span></div>}<div className="photo-actions"><label className={`button primary ${busy ? 'disabled' : ''}`}><Camera size={18}/>写真を撮る<input className="file-input" type="file" accept="image/*" capture="environment" disabled={busy} onChange={e => { void select(e.target.files?.[0]); e.target.value = ''; }}/></label><label className={`button secondary ${busy ? 'disabled' : ''}`}><ImagePlus size={18}/>ライブラリから<input className="file-input" type="file" accept="image/*" disabled={busy} onChange={e => { void select(e.target.files?.[0]); e.target.value = ''; }}/></label></div>{busy && <p role="status">処理中です…</p>}</section><section className="form-card"><h2>ひとこと、残しておく？</h2><label>訪問日時<input type="datetime-local" required value={visitedAt} onChange={e => setVisitedAt(e.target.value)} disabled={busy}/></label><label>メモ <span className="optional">任意</span><textarea placeholder="小ラーメン、麺少なめ。次はアブラ控えめでもよさそう。" maxLength={5000} rows={4} value={note} onChange={e => setNote(e.target.value)} disabled={busy}/></label><p className="fine-print">店舗・コール・食後評価の入力は、次の開発フェーズで追加予定です。</p></section>{error && <Notice>{error}</Notice>}<button className="button dark full" disabled={busy}>{busy ? <LoaderCircle className="spin" size={18}/> : <Check size={18}/>}下書きを保存 · 詳細はあとで</button><p className="fine-print centered">写真がなくても、訪問日時だけで保存できます。</p></form></div>;
}
function Detail({ visits, busy, refresh }: { visits: Visit[]; busy: boolean; refresh: () => Promise<void> }) {
  const { id } = useParams(); const visit = visits.find(v => v.id === id); const auth = useAuth(); const [note, setNote] = useState(''); const [message, setMessage] = useState(''); const [saving, setSaving] = useState(false);
  useEffect(() => { setNote(visit?.note ?? ''); }, [visit?.note]);
  if (!visit) return <div className="empty-state"><h2>{busy ? '記録を読み込み中…' : '記録を表示できません'}</h2><p>直近100件の記録を表示しています。通信状況もご確認ください。</p><Link to="/visits" className="button secondary">記録に戻る</Link></div>;
  const canEdit = auth.member?.user_id === visit.ownerId || auth.member?.role === 'admin';
  async function save(event: FormEvent) { event.preventDefault(); setSaving(true); setMessage(''); try { const { data, error } = await client().from('visits').update({ note: note || null }).eq('id', id!).select('id').single(); if (error || !data) throw error ?? new Error('更新できませんでした。'); await refresh(); setMessage('メモを保存しました。'); } catch (e) { setMessage(`保存できませんでした。入力はこの画面に残っています。${errorMessage(e)}`); } finally { setSaving(false); } }
  return <div className="narrow"><Link to="/visits" className="back-link"><ArrowLeft size={16}/>一杯の記録</Link><span className="eyebrow">BOWL NOTES</span><h1>{visit.shopName ?? '店舗はあとで。'}</h1><p className="muted">{date(visit.visitedAt)} · {visit.status === 'draft' ? '下書き' : '記録済み'}</p>{visit.photoPath && <div className="detail-photo"><Photo path={visit.photoPath}/></div>}<section className="form-card"><h2>一杯のメモ</h2>{canEdit ? <form onSubmit={save}><label>気づいたこと・次回の注文<textarea rows={6} maxLength={5000} value={note} onChange={e => setNote(e.target.value)} disabled={saving}/></label><button className="button primary" disabled={saving}>{saving ? '保存中…' : 'メモを保存'}</button></form> : <p className="preserve-lines">{visit.note || 'メモはまだありません。'}</p>}{message && <Notice>{message}</Notice>}</section></div>;
}
function SettingsPage({ pendingCount }: { pendingCount: number }) {
  const auth = useAuth(); const [error, setError] = useState('');
  return <div className="narrow"><span className="eyebrow">YOUR ACCOUNT</span><h1>設定</h1><section className="form-card"><h2>アカウント</h2><dl><dt>表示名</dt><dd>{auth.member?.display_name ?? 'プレビュー'}</dd><dt>利用権限</dt><dd>{auth.member?.role ?? '未接続'}</dd></dl>{!auth.preview && <><p className="fine-print">{pendingCount > 0 ? `未送信の記録が${pendingCount}件あります。ログアウト後もこの端末に残り、同じアカウントで再ログインすると再送します。` : 'ログイン状態は、このブラウザに保持されます。'}</p><button className="button secondary" onClick={async () => { try { await auth.signOut(); } catch (e) { setError(errorMessage(e)); } }}><LogOut size={17}/>ログアウト</button></>}</section><section className="form-card"><h2>ホーム画面に追加</h2><p className="muted">iPhoneのSafariで共有ボタンを開き、「ホーム画面に追加」を選ぶと、アプリのように起動できます。</p><p className="fine-print"><ArrowDown size={14}/> メニュー内に見つからない場合は、下へスクロールしてください。</p></section><section className="form-card"><h2>これからのJirō Log</h2><p className="muted">店舗・注文・食後評価、データのエクスポート、注文条件の分析を順次追加予定です。</p><span className="status-tag">基盤 / 写真下書き · v0.1.0</span></section>{error && <Notice>{error}</Notice>}</div>;
}
