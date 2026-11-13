import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getApiErrorMessage } from '../api/client';
import type { HelpRequest } from '../api/helpRequests';
import { acceptHelpRequest, declineHelpRequest, fetchMechanicHelpRequest } from '../api/mechanicHelp';
import type { MechanicStackParamList } from '../navigation/types';
import { incomingOfferUnavailableReason, type IncomingOfferUnavailable } from '../utils/incomingHelpOffer';
import { classifyAcceptError } from '../utils/mechanicAcceptErrors';

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
  /** Set after the server refused an accept for lack of free requests (402 SUBSCRIPTION_REQUIRED). */
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(false);

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
      const outcome = classifyAcceptError(e);
      if (outcome.kind === 'subscription') {
        setSubscriptionBlocked(true);
        Alert.alert(
          'Free requests used up',
          'You’ve used all your free requests, so you can’t accept this one. Get Mechanic Pro to keep accepting requests.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Get Mechanic Pro', onPress: () => navigation.navigate('MechanicSubscription') },
          ],
        );
      } else if (outcome.kind === 'unavailable') {
        // Lost the race or the offer ended: show the friendly full-screen state, not an error alert.
        setUnavailable(outcome.reason);
        return;
      } else if (outcome.kind === 'blocked') {
        Alert.alert(outcome.title, outcome.message, [
          { text: 'OK', style: 'cancel' },
          outcome.action === 'listing'
            ? { text: 'Open listing', onPress: () => navigation.navigate('MechanicOnboarding') }
            : { text: 'Dashboard', onPress: () => navigation.navigate('MechanicHome') },
        ]);
      } else {
        Alert.alert(outcome.title, outcome.message);
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
        Alert.alert('Couldn’t decline', getApiErrorMessage(e));
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
    subscriptionBlocked,
    onAccept,
    submitDecline,
    applyLoadedRequest,
  };
}
