/*
 * Copyright (c) 2018-2026 GraphDefined GmbH <achim.friedland@graphdefined.com>
 * This file is part of Chargy WebApp <https://github.com/OpenChargingCloud/ChargyWebApp>
 *
 * Licensed under the Affero GPL license, Version 3.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.gnu.org/licenses/agpl.html
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export type UILocale = "de" | "en";
export type DurationFormatStyle = "long" | "compact";

export function formatDuration(milliseconds: number,
                               language: UILocale,
                               style: DurationFormatStyle = "long"): string {

    if (!Number.isFinite(milliseconds) || milliseconds <= 0)
        return "";

    const totalSeconds = Math.floor(milliseconds / 1000);
    if (totalSeconds <= 0)
        return "";

    const days    = Math.floor(totalSeconds / 86400);
    const hours   = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (language === "de")
    {
        if (days > 1)
            return `${days} Tage ${hours} Std. ${minutes} Min. ${seconds} Sek.`;
        if (days === 1)
            return `${days} Tag ${hours} Std. ${minutes} Min. ${seconds} Sek.`;
        if (hours > 0)
            return `${hours} Std. ${minutes} Min. ${seconds} Sek.`;
        if (minutes > 0)
        {
            if (style === "compact")
                return `${minutes} Min. ${seconds} Sek.`;
            return `${minutes} ${minutes === 1 ? "Minute" : "Minuten"} ${seconds} ${seconds === 1 ? "Sekunde" : "Sekunden"}`;
        }
        if (style === "compact")
            return `${seconds} Sek.`;
        return `${seconds} ${seconds === 1 ? "Sekunde" : "Sekunden"}`;
    }

    if (days > 1)
        return `${days} days ${hours} h ${minutes} min ${seconds} s`;
    if (days === 1)
        return `${days} day ${hours} h ${minutes} min ${seconds} s`;
    if (hours > 0)
        return `${hours} h ${minutes} min ${seconds} s`;
    if (minutes > 0)
    {
        if (style === "compact")
            return `${minutes} min ${seconds} s`;
        return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ${seconds} ${seconds === 1 ? "second" : "seconds"}`;
    }
    if (style === "compact")
        return `${seconds} s`;
    return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;

}

export function formatTimeOfDay(timeHHMMSS: string,
                                language: UILocale): string {

    return language === "de"
        ? `${timeHHMMSS} Uhr`
        : timeHHMMSS;

}
