import { getGraphClient } from './graph';

export interface SecureScore {
  id: string;
  azureTenantId: string;
  currentScore: number;
  maxScore: number;
  averageComparativeScores: Array<{
    basis: string;
    score: number;
  }>;
  controlScores: Array<{
    controlName: string;
    score: number;
    maxScore: number;
    implementationStatus: string;
    remediation: string;
  }>;
  createdDateTime: string;
}

export async function getSecureScore(): Promise<SecureScore | null> {
  try {
    const client = getGraphClient();
    
    // First get the latest secure score ID
    const response = await client.api('/security/secureScores')
      .top(1)
      .orderby('createdDateTime desc')
      .get();

    if (response.value && response.value.length > 0) {
      // Then get the full details using the ID
      const scoreId = response.value[0].id;
      return await client.api(`/security/secureScores/${scoreId}`)
        .get();
    }

    return null;
  } catch (error) {
    console.error('Error fetching Secure Score:', error);
    throw error;
  }
}

export async function getSecureScoreHistory(months: number = 6): Promise<SecureScore[]> {
  try {
    const client = getGraphClient();
    
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    
    const response = await client.api('/security/secureScores')
      .filter(`createdDateTime ge ${startDate.toISOString()}`)
      .orderby('createdDateTime desc')
      .get();

    return response.value || [];
  } catch (error) {
    console.error('Error fetching Secure Score history:', error);
    throw error;
  }
}

export async function getRecommendedActions(): Promise<any[]> {
  try {
    const client = getGraphClient();

    // Récupérer le dernier Secure Score
    const response = await client.api('/security/secureScores')
      .top(1)
      .orderby('createdDateTime desc')
      .get();

    if (response.value && response.value.length > 0) {
      // Récupérer les détails du Secure Score en utilisant l'ID
      const scoreId = response.value[0].id;
      const scoreDetails = await client.api(`/security/secureScores/${scoreId}`)
        .get();

      const controlScores = scoreDetails.controlScores || [];

      // Filtrer, trier et formater les recommandations
      return controlScores
        .filter(control => control.implementationStatus !== 'implemented') // Filtrer les actions non implémentées
        .sort((a, b) => (b.maxScore - b.score) - (a.maxScore - a.score)) // Trier par priorité (écart entre maxScore et score)
        .slice(0, 5) // Limiter aux 5 premières recommandations
        .map(control => ({
          name: control.controlName, // Utiliser controlName au lieu de DisplayName
          displayName: control.DisplayName, // Utiliser controlCategory comme displayName
          score: control.score,
          maxScore: control.maxScore,
          remediation: control.description || 'Aucune description disponible', // Description de la recommandation
        }));
    } else {
      throw new Error('Aucun Secure Score trouvé.');
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des recommandations du Secure Score:', error);
    throw error;
  }
}