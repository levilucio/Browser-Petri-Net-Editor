import { useCallback } from 'react';
import { parseBooleanExpr } from '../../../utils/z3-arith';
import { parseArithmetic } from '../../../utils/arith-parser';
import { computeGlobalTypeInferenceForState } from '../useGlobalTypeInference';

export const useTransitionFormHandlers = ({
  formValues,
  setFormValues,
  getElementInfo,
  setElements,
  updateHistory,
  netMode,
  showInferredTypes,
}) => {
  const handleGuardBlur = useCallback(() => {
    const guardInput = formValues.guardText.trim();
    setFormValues((prev) => ({ ...prev, guardError: null }));

    const { elementId } = getElementInfo();

    if (!guardInput) {
      setElements((prev) => ({
        ...prev,
        transitions: prev.transitions.map((transition) => (transition.id === elementId ? { ...transition, guard: '' } : transition)),
      }));
      updateHistory();
      return;
    }

    try {
      parseBooleanExpr(guardInput, parseArithmetic);
      setElements((prev) => ({
        ...prev,
        transitions: prev.transitions.map((transition) => (transition.id === elementId ? { ...transition, guard: guardInput } : transition)),
      }));
      updateHistory();

      setElements((prev) => {
        const nextState = {
          ...prev,
          transitions: prev.transitions.map((transition) => (transition.id === elementId ? { ...transition, guard: guardInput } : transition)),
        };
        return computeGlobalTypeInferenceForState(nextState, netMode, showInferredTypes);
      });
      updateHistory();
    } catch (error) {
      setFormValues((prev) => ({ ...prev, guardError: `Invalid guard: ${error.message}` }));
    }
  }, [formValues.guardText, getElementInfo, netMode, setElements, setFormValues, updateHistory, showInferredTypes]);

  return {
    handleGuardBlur,
  };
};


