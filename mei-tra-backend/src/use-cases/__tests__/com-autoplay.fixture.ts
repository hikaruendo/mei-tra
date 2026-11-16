import { ComAutoPlayUseCase } from '../com-autoplay.use-case';

/**
 * Builds the use case with only the room service and COM check the caller
 * cares about; every other collaborator is an empty stub.
 */
export const createComAutoPlayUseCase = (
  roomService: object,
  isComPlayer: () => boolean,
) =>
  new ComAutoPlayUseCase(
    roomService as never,
    { isComPlayer } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
