/**
 * Server error text -> translation key.
 *
 * The server sends `error-message` as English text, which both clients used to
 * show as it arrived. Every message it can send is named here so each client
 * can translate it; anything unknown is still shown as it arrives. Reword a
 * message on the server and it lands here as unknown, so keep the two in step.
 */
const SERVER_ERROR_KEYS = new Map<string, string>([
  ["Authentication failed", 'authenticationFailed'],
  ["Authentication required", 'authenticationRequired'],
  ["Account deletion is in progress. Please finish deleting this account before continuing.", 'accountDeletionIsInProgressPleaseFinishDeleting'],
  ["Broken hand request is stale", 'brokenHandRequestIsStale'],
  ["Broken hand reveal is not pending", 'brokenHandRevealIsNotPending'],
  ["COM cannot report chombos", 'cOMCannotReportChombos'],
  ["COM has no card available to select as Negri", 'cOMHasNoCardAvailableToSelectAs'],
  ["COM seat is not reclaimable", 'cOMSeatIsNotReclaimable'],
  ["Cannot declare now", 'cannotDeclareNow'],
  ["Cannot pass now", 'cannotPassNow'],
  ["Cannot recover a game without players", 'cannotRecoverAGameWithoutPlayers'],
  ["Cannot reveal broken hand now", 'cannotRevealBrokenHandNow'],
  ["Cannot select Negri card now", 'cannotSelectNegriCardNow'],
  ["Cannot select base suit", 'cannotSelectBaseSuit'],
  ["Cannot select base suit now", 'cannotSelectBaseSuitNow'],
  ["Card already played on the field", 'cardAlreadyPlayedOnTheField'],
  ["Card already played or invalid", 'cardAlreadyPlayedOrInvalid'],
  ["Chombo reporting window has ended", 'chomboReportingWindowHasEnded'],
  ["Chombo reports are only available during play", 'chomboReportsAreOnlyAvailableDuringPlay'],
  ["Chombo reports are only available in pro mode", 'chomboReportsAreOnlyAvailableInProMode'],
  ["Chombo scenarios are only available in development", 'chomboScenariosAreOnlyAvailableInDevelopment'],
  ["Chombo scenarios need a game in progress", 'chomboScenariosNeedAGameInProgress'],
  ["Chombo scenarios need a pro mode room", 'chomboScenariosNeedAProModeRoom'],
  ["Chombo scenarios need four seats", 'chomboScenariosNeedFourSeats'],
  ["Current field is being completed, please wait", 'currentFieldIsBeingCompletedPleaseWait'],
  ["Current seat already played in this field", 'currentSeatAlreadyPlayedInThisField'],
  ["Declaration winner not found among players", 'declarationWinnerNotFoundAmongPlayers'],
  ["Declaring team could not be determined", 'declaringTeamCouldNotBeDetermined'],
  ["Each team must have at most 2 players", 'eachTeamMustHaveAtMost2Players'],
  ["Failed to change teams", 'failedToChangeTeams'],
  ["Failed to create room", 'failedToCreateRoom'],
  ["Failed to declare blow", 'failedToDeclareBlow'],
  ["Failed to declare open", 'failedToDeclareOpen'],
  ["Failed to determine declaration winner", 'failedToDetermineDeclarationWinner'],
  ["Failed to fill with COM players", 'failedToFillWithCOMPlayers'],
  ["Failed to finalize COM broken hand reveal", 'failedToFinalizeCOMBrokenHandReveal'],
  ["Failed to join room", 'failedToJoinRoom'],
  ["Failed to pass blow", 'failedToPassBlow'],
  ["Failed to persist completed field", 'failedToPersistCompletedField'],
  ["Failed to persist player connection", 'failedToPersistPlayerConnection'],
  ["Failed to play card", 'failedToPlayCard'],
  ["Failed to prepare COM broken hand reveal", 'failedToPrepareCOMBrokenHandReveal'],
  ["Failed to process broken hand", 'failedToProcessBrokenHand'],
  ["Failed to replace player with COM", 'failedToReplacePlayerWithCOM'],
  ["Failed to report chombo", 'failedToReportChombo'],
  ["Failed to retrieve updated room", 'failedToRetrieveUpdatedRoom'],
  ["Failed to reveal Agari", 'failedToRevealAgari'],
  ["Failed to select Negri", 'failedToSelectNegri'],
  ["Failed to select base suit", 'failedToSelectBaseSuit'],
  ["Failed to set up the chombo scenario", 'failedToSetUpTheChomboScenario'],
  ["Failed to start game", 'failedToStartGame'],
  ["Failed to update player ready state", 'failedToUpdatePlayerReadyState'],
  ["Failed to update team names", 'failedToUpdateTeamNames'],
  ["Failed to watch room", 'failedToWatchRoom'],
  ["Field identity is unavailable", 'fieldIdentityIsUnavailable'],
  ["Game is not active", 'gameIsNotActive'],
  ["Game state error: No current field", 'gameStateErrorNoCurrentField'],
  ["Game state not found", 'gameStateNotFound'],
  ["Host cannot moderate themselves", 'hostCannotModerateThemselves'],
  ["In Tanzen round, you must play the Joker if you have it.", 'inTanzenRoundYouMustPlayTheJoker'],
  ["Internal server error", 'internalServerError'],
  ["Invalid declaration", 'invalidDeclaration'],
  ["It's not your turn to declare", 'itsNotYourTurnToDeclare'],
  ["It's not your turn to pass", 'itsNotYourTurnToPass'],
  ["It's not your turn to play", 'itsNotYourTurnToPlay'],
  ["It's not your turn to select Negri", 'itsNotYourTurnToSelectNegri'],
  ["It's not your turn to select base suit", 'itsNotYourTurnToSelectBaseSuit'],
  ["Negri selection window has ended", 'negriSelectionWindowHasEnded'],
  ["No token provided", 'noTokenProvided'],
  ["No winner determined for field", 'noWinnerDeterminedForField'],
  ["Not watching this room", 'notWatchingThisRoom'],
  ["Only the declaration winner may select Negri", 'onlyTheDeclarationWinnerMaySelectNegri'],
  ["Only the host can add COM players", 'onlyTheHostCanAddCOMPlayers'],
  ["Only the host can change team names", 'onlyTheHostCanChangeTeamNames'],
  ["Only the host can change teams", 'onlyTheHostCanChangeTeams'],
  ["Only the host can moderate players", 'onlyTheHostCanModeratePlayers'],
  ["Only the host can shuffle teams", 'onlyTheHostCanShuffleTeams'],
  ["Open has already been declared", 'openHasAlreadyBeenDeclared'],
  ["Open evaluation exceeded its search limit", 'openEvaluationLimit'],
  ["Open is only available during play", 'openIsOnlyAvailableDuringPlay'],
  ["Open is only available in pro mode", 'openIsOnlyAvailableInProMode'],
  ["Open is only available while you hold cards", 'openIsOnlyAvailableWhileYouHoldCards'],
  ["Open is only available with four or fewer cards in hand", 'openIsOnlyAvailableWithFourOrFewer'],
  ["Open requires a completed declaration", 'openRequiresACompletedDeclaration'],
  ["Play field is unavailable", 'playFieldIsUnavailable'],
  ["Play is settled after a valid open", 'playIsSettledAfterAValidOpen'],
  ["Play state is unavailable", 'playStateIsUnavailable'],
  ["Player does not have broken hand", 'playerDoesNotHaveBrokenHand'],
  ["Player mismatch for broken hand", 'playerMismatchForBrokenHand'],
  ["Player not found in game state", 'playerNotFoundInGameState'],
  ["Player not found in room", 'playerNotFoundInRoom'],
  ["Players can only be removed in the waiting room", 'playersCanOnlyBeRemovedInTheWaiting'],
  ["Room not found", 'roomNotFound'],
  ["Room player not found", 'roomPlayerNotFound'],
  ["Selected card is not in hand", 'selectedCardIsNotInHand'],
  ["Spectators are not allowed", 'spectatorsAreNotAllowed'],
  ["Spectators cannot moderate players", 'spectatorsCannotModeratePlayers'],
  ["Spectators cannot start the game", 'spectatorsCannotStartTheGame'],
  ["Spectators cannot toggle ready", 'spectatorsCannotToggleReady'],
  ["Target player not found", 'targetPlayerNotFound'],
  ["Team names can only be changed while waiting", 'teamNamesCanOnlyBeChangedWhileWaiting'],
  ["Teams can only be shuffled while waiting", 'teamsCanOnlyBeShuffledWhileWaiting'],
  ["Token validation failed", 'tokenValidationFailed'],
  ["You can only report the opposing team", 'youCanOnlyReportTheOpposingTeam'],
  ["You have already declared in this blow phase", 'youHaveAlreadyDeclaredInThisBlowPhase'],
  ["You have already passed in this blow phase", 'youHaveAlreadyPassedInThisBlowPhase'],
]);

/** `Spectators cannot ${action}`, built by SpectatorGatewayEffectsService. */
const SPECTATOR_ACTION_PREFIX = 'Spectators cannot ';
const SPECTATOR_ACTION_KEY = 'spectatorAction';

/**
 * Messages the server builds from game state. Each regex is anchored and its
 * capture groups are named in `params`, so the client can feed them to its own
 * placeholders instead of showing the English sentence.
 */
const SERVER_ERROR_PATTERNS: readonly {
  readonly pattern: RegExp;
  readonly key: string;
  readonly params: readonly string[];
}[] = [
  {
    pattern: /^You must play the Joker since you have no (.+) cards\.$/,
    key: 'youMustPlayTheJokerSinceYouHaveNoSuitCards',
    params: ['suit'],
  },
  {
    pattern: /^You must play a card of suit (.+)\.$/,
    key: 'youMustPlayACardOfSuit',
    params: ['suit'],
  },
  {
    pattern: /^Invalid team for seat (.+)$/,
    key: 'invalidTeamForSeat',
    params: ['seatId'],
  },
  {
    pattern: /^Seat (.+) not found$/,
    key: 'seatNotFound',
    params: ['seatId'],
  },
];

export interface ServerErrorTranslation {
  key: string;
  params?: Record<string, string>;
}

/** Every key `serverErrorTranslation` can return, for the catalogue tests. */
export const SERVER_ERROR_TRANSLATION_KEYS: readonly string[] = [
  ...new Set([
    ...SERVER_ERROR_KEYS.values(),
    ...SERVER_ERROR_PATTERNS.map((entry) => entry.key),
    SPECTATOR_ACTION_KEY,
  ]),
];

export function serverErrorTranslation(
  message: string,
): ServerErrorTranslation | null {
  const exact = SERVER_ERROR_KEYS.get(message);
  if (exact) {
    return { key: exact };
  }

  for (const { pattern, key, params } of SERVER_ERROR_PATTERNS) {
    const match = pattern.exec(message);
    if (match) {
      return {
        key,
        params: Object.fromEntries(
          params.map((name, index) => [name, match[index + 1] ?? '']),
        ),
      };
    }
  }

  return message.startsWith(SPECTATOR_ACTION_PREFIX)
    ? { key: SPECTATOR_ACTION_KEY }
    : null;
}

export function serverErrorKey(message: string): string | null {
  return serverErrorTranslation(message)?.key ?? null;
}
