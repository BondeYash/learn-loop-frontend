import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useDecision } from "../../components/DecisionProvider.jsx";
import { getCategories } from "../../services/courseService.js";
import axiosInstance, { errorMessage } from "../../services/axiosInstance.js";

export default function CreateCoursePage() {
  const decide = useDecision();
  const { id } = useParams(); const editing = Boolean(id);
  const isAdmin = useSelector((state) => state.auth.user?.role === "admin");
  const back = editing ? `/instructor/courses/${id}/curriculum` : isAdmin ? "/admin?tab=courses" : "/instructor/courses";
  const navigate = useNavigate(); const [categories, setCategories] = useState([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting, isDirty } } = useForm({ defaultValues: { pricingType: "free", price: "", level: "beginner", language: "English", requirements: "", learningOutcomes: "" } });
  const pricingType = watch("pricingType");
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    Promise.all([getCategories(), editing ? axiosInstance.get(`/courses/mine/${id}`) : Promise.resolve(null)])
      .then(([items, result]) => {
        if (!active) return;
        setCategories(items);
        if (!editing && items[0]) setValue("category", items[0]._id);
        if (result) {
          const course = result.data.data.course;
          if (course.archivedAt) { setError("Restore this archived course before editing."); return; }
          reset({ title: course.title, description: course.description, pricingType: course.price > 0 ? "paid" : "free", price: course.price > 0 ? String(course.price) : "", category: course.category?._id, level: course.level, language: course.language, requirements: (course.requirements || []).join("\n"), learningOutcomes: (course.learningOutcomes || []).join("\n") });
        }
      }).catch((e) => { if (active) setError(errorMessage(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, editing, reset, setValue]);
  const submit = async (values) => {
    setError("");
    const { pricingType: selectedPricing, ...fields } = values;
    const payload = { ...fields, price: selectedPricing === "free" ? 0 : values.price, ...(!editing ? { setupLessons: true } : {}), requirements: values.requirements.split("\n").map((s) => s.trim()).filter(Boolean), learningOutcomes: values.learningOutcomes.split("\n").map((s) => s.trim()).filter(Boolean) };
    try {
      const { data } = editing ? await axiosInstance.patch(`/courses/${id}`, payload) : await axiosInstance.post("/courses", payload);
      navigate(`/instructor/courses/${data.data.course._id}/curriculum`, { replace: editing });
    } catch (e) { setError(errorMessage(e)); }
  };
  const cancel = async (event) => { if (!isDirty) return; event.preventDefault(); const to = event.currentTarget.getAttribute("href"); if (await decide({ title: "Discard unsaved changes?", body: "Your course details have not been saved. Leaving this page will discard your edits.", confirmLabel: "Discard changes", destructive: true })) navigate(to); };
  return <section className="mx-auto max-w-3xl"><Link to={back} onClick={cancel} className="text-sm text-primary-600 dark:text-primary-300">← Back to {editing ? "curriculum" : "courses"}</Link><p className="mt-7 text-xs font-medium uppercase tracking-[.14em] text-slate-500 dark:text-slate-400">Course details</p><h1 className="mt-3 text-3xl font-semibold">{editing ? "Edit course details" : "Create a course"}</h1><p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{editing ? "Update the details students see. Curriculum and assignments are managed separately." : "Add the details below, upload lessons or PDF notes, then choose your students."}</p>
    {loading ? <p className="card mt-6" role="status">Loading course details…</p> : <form onSubmit={handleSubmit(submit)} className="card mt-6 space-y-5">
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <label className="block text-sm font-medium">Course title<input className="input-field mt-2" maxLength={160} disabled={isSubmitting} {...register("title", { required: "A course title is required", maxLength: 160 })} aria-invalid={Boolean(errors.title)} /></label>{errors.title && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{errors.title.message}</p>}
      <label className="block text-sm font-medium">Description<textarea className="input-field mt-2 min-h-32" maxLength={10000} disabled={isSubmitting} {...register("description", { required: "A description is required" })} aria-invalid={Boolean(errors.description)} /></label>{errors.description && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{errors.description.message}</p>}
      <div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-medium">Category<select className="input-field mt-2" disabled={isSubmitting} {...register("category", { required: "Choose a category" })}><option value="">Choose a category</option>{categories.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label><label className="block text-sm font-medium">Level<select className="input-field mt-2" disabled={isSubmitting} {...register("level")}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label></div>{errors.category && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{errors.category.message}</p>}
      <label className="block text-sm font-medium">Language<input className="input-field mt-2" maxLength={50} disabled={isSubmitting} {...register("language")} /></label>
      <fieldset disabled={isSubmitting}><legend className="text-sm font-medium">Course pricing</legend><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${pricingType === "free" ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20" : "border-slate-200 dark:border-slate-600"}`}><input className="mt-1 accent-teal-600" type="radio" value="free" {...register("pricingType")} /><span><span className="block text-sm font-semibold">Free</span><span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">Assigned students can open all course materials without payment.</span></span></label><label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${pricingType === "paid" ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20" : "border-slate-200 dark:border-slate-600"}`}><input className="mt-1 accent-teal-600" type="radio" value="paid" {...register("pricingType")} /><span><span className="block text-sm font-semibold">Paid</span><span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">Assigned students pay the INR price before opening course materials.</span></span></label></div><p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{pricingType === "free" ? "Free courses do not need Stripe. Students still need an assignment and an active account." : "Payment must be verified before lessons and PDF notes open."}{editing && " Changing pricing keeps assignments, progress and payment history. Students without a verified purchase will need to pay when this course is paid again."}</p></fieldset>
      <div hidden={pricingType !== "paid"}><label className="block text-sm font-medium">Course price (INR)<input className="input-field mt-2" type="number" min="0.50" max="999999.99" step="0.01" disabled={isSubmitting || pricingType !== "paid"} {...register("price", { validate: (value) => pricingType === "free" || /^\d{1,6}(\.\d{1,2})?$/.test(value) && Number(value) >= 0.5 || "Set a paid price of at least 0.50, with up to two decimals" })} aria-invalid={Boolean(errors.price)} /></label>{errors.price && pricingType === "paid" && <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">{errors.price.message}</p>}</div>
      <details><summary className="cursor-pointer text-sm font-medium">Requirements and learning outcomes (optional)</summary><div className="mt-4 grid gap-5 sm:grid-cols-2"><label className="block text-sm font-medium">Requirements<span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">One item per line</span><textarea className="input-field mt-2 min-h-28" disabled={isSubmitting} {...register("requirements")} /></label><label className="block text-sm font-medium">Learning outcomes<span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">One item per line</span><textarea className="input-field mt-2 min-h-28" disabled={isSubmitting} {...register("learningOutcomes")} /></label></div></details>
      <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5 dark:border-[#303035]"><Link className={`btn-secondary ${isSubmitting ? "pointer-events-none opacity-50" : ""}`} to={back} onClick={cancel}>Cancel</Link><button disabled={isSubmitting || !categories.length} className="btn-primary">{isSubmitting ? "Saving…" : editing ? "Save course details" : "Continue to content"}</button></div>
    </form>}
  </section>;
}
