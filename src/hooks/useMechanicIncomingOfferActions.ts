import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getApiErrorMessage } from '../api/client';
import type { HelpRequest } from '../api/helpRequests';
import { acceptHelpRequest, declineHelpRequest, fetchMechanicHelpRequest } from '../api/mechanicHelp';
import type { MechanicStackParamList } from '../navigation/types';
import { acceptLostRaceKind, incomingOfferUnavailableReason, type IncomingOfferUnavailable } from '../utils/incomingHelpOffer';
import { subscriptionRequiredMessage } from '../utils/mechanicAcceptErrors';

type Nav = NativeStackNavigationProp<MechanicStackParamList>;

type Options = {
  helpRequestId: number;
  navigation: Nav;
  origin?: { latitude: number; longitude: number } | null;
  onRequestLoaded?: (request: HelpRequest | null) => void;
  /** When true, auto-detect offers that disappeared while viewing (incoming detail). */
  watchOfferAvailability?: boolean;
  includeEndedOffers?: boolean;
};

export function useMechanicIncomingOfferActions({
  helpRequestId,
  navigation,
  origin,
  onRequestLoaded,
  watchOfferAvailability = false,
  includeEndedOffers = true,
}: Options) {
  const [acting, setActing] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [unavailable, setUnavailable] = useState<IncomingOfferUnavailable | null>(null);

  const applyLoadedRequest = useCallback(
    (request: HelpRequest | null) => {
      onRequestLoaded?.(request);
      if (watchOfferAvailability && request) {
        const reason = incomingOfferUnavailableReason(request, { includeEnded: includeEndedOffers });
        if (reason) {
          setUnavailable(reason);
        }
      }
    },
    [onRequestLoaded, watchOfferAvailability, includeEndedOffers],
  );

  const reload = useCallback(async () => {
    try {
      const fresh = await fetchMechanicHelpRequest(helpRequestId, origin ?? undefined);
      applyLoadedRequest(fresh);
      return fresh;
    } catch {
      applyLoadedRequest(null);
      return null;
    }
  }, [applyLoadedRequest, helpRequestId, origin?.latitude, origin?.longitude]);

  const onAccept = useCallback(async () => {
    setActing(true);
    try {
      const accepted = await acceptHelpRequest(helpRequestId);
      navigation.replace('ActiveJob', {
        helpRequestId,
        justAccepted: true,
        initialRequest: accepted,
      });
    } catch (e) {
      const subMsg = subscriptionRequiredMessage(e);
      if (subMsg) {
        Alert.alert('Mechanic Pro required', subMsg, [
          { text: 'Not now', style: 'cancel' },
          { text: 'Subscribe', onPress: () => navigation.navigate('MechanicSubscription') },
        ]);
      } else {
        const lost = acceptLostRaceKind(e);
        if (lost) {
          setUnavailable(lost);
        } else {
          Alert.alert('Could not accept', getApiErrorMessage(e));
        }
      }
      await reload();
    } finally {
      setActing(false);
    }
  }, [helpRequestId, navigation, reload]);

  const submitDecline = useCallback(
    async (reason?: string) => {
      setActing(true);
      try {
        await declineHelpRequest(helpRequestId, reason);
        setDeclineOpen(false);
        navigation.goBack();
      } catch (e) {
        Alert.alert('Decline failed', getApiErrorMessage(e));
      } finally {
        setActing(false);
      }
    },
    [helpRequestId, navigation],
  );

  return {
    acting,
    declineOpen,
    setDeclineOpen,
    unavailable,
    setUnavailable,
    onAccept,
    submitDecline,
    applyLoadedRequest,
  };
}
