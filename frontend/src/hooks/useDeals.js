import { useState, useCallback } from "react";
import api from "../services/api";

const useDeals = () => {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchDeals = useCallback(async (filters = {}) => {
    setLoading(true);
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.stage) params.stage = filters.stage;
      if (filters.contactId) params.contactId = filters.contactId;

      const { data } = await api.get("/dape/pipeline/deals", { params });
      setDeals(data);
      return data;
    } catch (err) {
      console.error("[useDeals] fetchDeals error:", err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createDeal = useCallback(async (dealData) => {
    try {
      const { data } = await api.post("/dape/pipeline/deals", dealData);
      setDeals(prev => [...prev, data]);
      return data;
    } catch (err) {
      console.error("[useDeals] createDeal error:", err);
      throw err;
    }
  }, []);

  const updateDeal = useCallback(async (id, dealData) => {
    try {
      const { data } = await api.put(`/dape/pipeline/deals/${id}`, dealData);
      setDeals(prev => prev.map(d => d.id === id ? data : d));
      return data;
    } catch (err) {
      console.error("[useDeals] updateDeal error:", err);
      throw err;
    }
  }, []);

  const deleteDeal = useCallback(async (id) => {
    try {
      await api.delete(`/dape/pipeline/deals/${id}`);
      setDeals(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      console.error("[useDeals] deleteDeal error:", err);
      throw err;
    }
  }, []);

  return { deals, loading, fetchDeals, createDeal, updateDeal, deleteDeal };
};

export default useDeals;
