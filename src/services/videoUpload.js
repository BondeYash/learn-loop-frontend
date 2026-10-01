import axios from "axios";
import axiosInstance from "./axiosInstance.js";
import { validateVideo } from "./validateVideo.js";
const sha256 = async (blob) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())), (value) => value.toString(16).padStart(2, "0")).join("");
export async function uploadVideo(lessonId, file, { signal, onProgress, onVideo, onStage = () => {} }) {
  if (!crypto.subtle) throw new Error("Uploads require HTTPS or localhost.");
  onStage("Checking MP4 playback in your browser…");
  const media = await validateVideo(file, signal);
  const fingerprint = await sha256(new Blob([file.name, String(file.size), String(file.lastModified), file.slice(0, 1024 * 1024), file.slice(-1024 * 1024)]));
  const { data } = await axiosInstance.post(`/lessons/${lessonId}/direct-uploads`, { filename: file.name, size: file.size, fingerprint, ...media }, { signal });
  const video = data.data.video;
  onVideo(video);
  if (video.status === "ready") return video;
  if (video.status === "verifying") return (await axiosInstance.post(`/direct-uploads/${video._id}/complete`, {}, { signal })).data.data.video;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ticket = (await axiosInstance.post(`/direct-uploads/${video._id}/url`, {}, { signal })).data.data;
    onStage("Uploading directly to private storage"); onProgress(0);
    try {
      await axios.put(ticket.url, file, { signal, withCredentials: false, timeout: 60 * 60 * 1000, headers: ticket.headers, onUploadProgress: ({ loaded }) => onProgress(Math.min(100, Math.round(loaded / file.size * 100))) });
      break;
    } catch (error) {
      if (signal?.aborted) throw error;
      if (attempt === 0 && (error.response?.status === 403 || Date.now() > ticket.expiresAt - 10000)) continue;
      throw new Error("Direct upload failed. Check your connection and the storage CORS configuration, then select the same MP4 to retry from the beginning.");
    }
  }
  onStage("Checking the uploaded file…"); onProgress(100);
  return (await axiosInstance.post(`/direct-uploads/${video._id}/complete`, {}, { signal, timeout: 120000 })).data.data.video;
}
