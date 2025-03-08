import { Realtime, } from "ably"
import Spaces, { type CursorUpdate } from "@ably/spaces";
import { PUBLIC_ABLYAPI } from "$env/static/public"
import type { SerializedLineType } from "$lib/components/canvas/CanvasController.svelte";

const userColors: string[] = [
    "#FF5733", "#33FF57", "#3357FF", "#FF33A1", "#A133FF",
    "#57FF33", "#33A1FF", "#FF8C33", "#8C33FF", "#33FF8C",
    "#FF3333", "#33FFFF", "#FF33FF", "#FFFF33", "#33FF33",
    "#337FFF", "#7F33FF", "#FF7F33", "#7FFF33", "#33FF7F",
    "#FF3366", "#3366FF", "#66FF33", "#FF6633", "#6633FF",
    "#33FF66", "#66FF66", "#6666FF", "#FF9966", "#6699FF"
];

function randomColor() {
    return userColors[Math.floor(Math.random() * userColors.length)];
}

interface UserType {
    id: string, // uuid
    username?: string,
    color: string
}

export interface CursorInfo {
    position: {
        x: number, y: number
    },
    data: {
        user: UserType,
        currentLine?: SerializedLineType | undefined
    }
}

export async function joinSpace(username?: string, onCursorUpdate?: (cursorEvent: CursorUpdate) => void, deleteEvent?: (idsToDelete: string[]) => void) {
    // const clientId = localStorage.getItem("clientId") ?? crypto.randomUUID();
    // localStorage.setItem("clientId", clientId)
    const clientId = crypto.randomUUID();
    const realtimeClient = new Realtime({
        key: PUBLIC_ABLYAPI,
        clientId
    });
    const spaces = new Spaces(realtimeClient);

    const canvasSpace = await spaces.get("canvas", { cursors: { paginationLimit: 0, outboundBatchInterval: 20 }, offlineTimeout: 10, },);


    const user: UserType = {
        id: crypto.randomUUID(),
        color: randomColor(),
        username: username ?? ""
    }
    await canvasSpace.enter({ ...user },);

    // live cursor update
    canvasSpace.cursors.subscribe("update", (e) => {
        if (e.clientId !== clientId) {
            onCursorUpdate && onCursorUpdate(e);
        }
    });

    // delete
    const deleteChannel = realtimeClient.channels.get("delete",);
    deleteChannel.subscribe("deleteLines", (e) => {
        deleteEvent && deleteEvent((e.data as string[]) ?? []);
    });

    return {
        canvasSpace,
        user,
        unsubscribe: () => {
            canvasSpace.leave();
            realtimeClient.close();
        },
        updateProfile: (name: string, color:string) => {
            canvasSpace.updateProfileData({
                ...user,
                color,
                username: name
            })
        },
        updateCursor: (x: number, y: number, user: UserType, currentLine?: SerializedLineType,) => {
            if(!user || !user.username || user.username.length === 0){
                return;
            }
            canvasSpace.cursors.set({
                position: {
                    x, y
                }, data: {
                    user,
                    currentLine
                }
            })
        },
        async deleteLines(toDelete: string[]) {

            await deleteChannel.publish("deleteLines", toDelete);

        }

    }
}