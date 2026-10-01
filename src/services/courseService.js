import axiosInstance from "./axiosInstance.js";
export const getCourses = () => axiosInstance.get("/courses").then(({ data }) => data.data.courses);
export const getCourse = (id) => axiosInstance.get(`/courses/${id}`).then(({ data }) => data.data);
export const getMyCourses = () => axiosInstance.get("/courses/mine").then(({ data }) => data.data.courses);
export const getCategories = () => axiosInstance.get("/categories").then(({ data }) => data.data.categories);
