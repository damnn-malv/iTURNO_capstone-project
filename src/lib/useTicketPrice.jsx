import { useState, useEffect } from "react";
import { apiService } from "./api-service";
import { useConfirm } from "../components/ui/ToastConfirmContext";

export function useTicketPrice() {
  const [ticketFee, setTicketFee] = useState(0);
  const [ticketPriceError, setTicketPriceError] = useState("");
  const [ticketPriceLoading, setTicketPriceLoading] = useState(true);
  const [isTicketPriceModalOpen, setIsTicketPriceModalOpen] = useState(false);
  const [newTicketPrice, setNewTicketPrice] = useState("");
  const [isSavingTicketPrice, setIsSavingTicketPrice] = useState(false);
  const showConfirm = useConfirm();

  const fetchTicketFee = async () => {
    try {
      setTicketPriceLoading(true);
      setTicketPriceError("");
      const prices = await apiService.getTicketPrices();
      if (Array.isArray(prices) && prices.length > 0) {
        setTicketFee(Number(prices[0].amount || 0));
      } else {
        setTicketFee(0);
      }
    } catch (err) {
      setTicketFee(0);
      setTicketPriceError(
        err.message || "Unable to load current ticket price.",
      );
    } finally {
      setTicketPriceLoading(false);
    }
  };

  const saveTicketPrice = async () => {
    const amount = Number(newTicketPrice);
    if (!amount || amount <= 0) {
      setTicketPriceError("Enter a valid ticket price.");
      return;
    }

    try {
      setIsSavingTicketPrice(true);
      setTicketPriceError("");
      const created = await apiService.createTicketPrice({ amount });
      setTicketFee(Number(created.amount || 0));
      setIsTicketPriceModalOpen(false);
      setNewTicketPrice("");
    } catch (err) {
      setTicketPriceError(err.message || "Failed to save ticket price.");
    } finally {
      setIsSavingTicketPrice(false);
    }
  };

  useEffect(() => {
    fetchTicketFee();
  }, []);

  return {
    ticketFee,
    ticketPriceError,
    ticketPriceLoading,
    isTicketPriceModalOpen,
    setIsTicketPriceModalOpen,
    newTicketPrice,
    setNewTicketPrice,
    saveTicketPrice,
    isSavingTicketPrice,
    fetchTicketFee,
  };
}
