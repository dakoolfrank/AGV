import { useState, useCallback } from 'react';

export interface ChannelVerificationState {
  channelIndex: number;
  isVerifying: boolean;
  isVerified: boolean;
  error: string | null;
  verificationData: any;
}

export const useSocialMediaVerification = () => {
  const [verificationStates, setVerificationStates] = useState<ChannelVerificationState[]>([]);

  const startVerification = useCallback((channelIndex: number) => {
    setVerificationStates(prev => 
      prev.map(state => 
        state.channelIndex === channelIndex 
          ? { ...state, isVerifying: true, error: null }
          : state
      )
    );
  }, []);

  const completeVerification = useCallback((channelIndex: number, verificationData: any) => {
    setVerificationStates(prev => 
      prev.map(state => 
        state.channelIndex === channelIndex 
          ? { 
              ...state, 
              isVerifying: false, 
              isVerified: true, 
              verificationData,
              error: null 
            }
          : state
      )
    );
  }, []);

  const failVerification = useCallback((channelIndex: number, error: string) => {
    setVerificationStates(prev => 
      prev.map(state => 
        state.channelIndex === channelIndex 
          ? { 
              ...state, 
              isVerifying: false, 
              isVerified: false, 
              error 
            }
          : state
      )
    );
  }, []);

  const resetVerification = useCallback((channelIndex: number) => {
    setVerificationStates(prev => 
      prev.map(state => 
        state.channelIndex === channelIndex 
          ? { 
              ...state, 
              isVerifying: false, 
              isVerified: false, 
              error: null,
              verificationData: null 
            }
          : state
      )
    );
  }, []);

  const initializeChannel = useCallback((channelIndex: number) => {
    setVerificationStates(prev => {
      const existingState = prev.find(state => state.channelIndex === channelIndex);
      if (existingState) return prev;
      
      return [...prev, {
        channelIndex,
        isVerifying: false,
        isVerified: false,
        error: null,
        verificationData: null
      }];
    });
  }, []);

  const getVerificationState = useCallback((channelIndex: number): ChannelVerificationState | undefined => {
    return verificationStates.find(state => state.channelIndex === channelIndex);
  }, [verificationStates]);

  const getAllVerificationStates = useCallback(() => {
    return verificationStates;
  }, [verificationStates]);

  const isAnyVerifying = useCallback(() => {
    return verificationStates.some(state => state.isVerifying);
  }, [verificationStates]);

  const getVerifiedCount = useCallback(() => {
    return verificationStates.filter(state => state.isVerified).length;
  }, [verificationStates]);

  const getTotalCount = useCallback(() => {
    return verificationStates.length;
  }, [verificationStates]);

  return {
    verificationStates,
    startVerification,
    completeVerification,
    failVerification,
    resetVerification,
    initializeChannel,
    getVerificationState,
    getAllVerificationStates,
    isAnyVerifying,
    getVerifiedCount,
    getTotalCount
  };
};