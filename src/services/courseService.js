import axiosInstance from "./axiosInstance.js";
export const getCourses = () => axiosInstance.get("/courses").then(({ data }) => data.data.courses);
export const getCourse = (id) => axiosInstance.get(`/courses/${id}`).then(({ data }) => data.data);
export const getMyCourses = (archived = false) => axiosInstance.get("/courses/mine", { params: { archived } }).then(({ data }) => data.data.courses);
export const getCategories = () => axiosInstance.get("/categories").then(({ data }) => data.data.categories);
