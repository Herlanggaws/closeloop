package httpapi

import (
	"errors"
	"strings"

	"github.com/closeloop/api/internal/application"
	"github.com/gin-gonic/gin"
)

// Multi-repo per project HTTP surface (D-12…D-14).

// mapRepoErr writes repo-specific error codes, falling back to the shared mapper.
func (s *Server) mapRepoErr(c *gin.Context, err error) {
	var conflict *application.PlatformConflictError
	switch {
	case errors.As(err, &conflict):
		c.JSON(409, gin.H{"error": gin.H{
			"code":     "PLATFORM_CONFLICT",
			"message":  conflict.Error(),
			"platform": conflict.Platform,
			"repo":     conflict.Repo,
		}})
	case errors.Is(err, application.ErrRepoLimit):
		msg := err.Error()
		if msg == application.ErrRepoLimit.Error() {
			msg = "This project has as many repos as your plan includes."
		}
		c.JSON(402, gin.H{"error": gin.H{
			"code":        "REPO_LIMIT",
			"message":     msg,
			"upgrade_url": s.upgradeURL(),
		}})
	case errors.Is(err, application.ErrRepoNotConnected):
		writeErr(c, 400, "REPO_NOT_CONNECTED", "That repo is not connected to this project.")
	default:
		s.mapErr(c, err)
	}
}

func (s *Server) reposPayload(c *gin.Context, projectID string) (gin.H, error) {
	repos, err := s.Store.ListProjectRepos(c.Request.Context(), projectID)
	if err != nil {
		return nil, err
	}
	plan, err := s.Store.OrgPlanForProject(c.Request.Context(), projectID)
	if err != nil {
		return nil, err
	}
	crossRead, err := s.Store.CrossRepoRead(c.Request.Context(), projectID)
	if err != nil {
		return nil, err
	}
	return gin.H{
		"repos":                 repos,
		"usage":                 application.UsageCounter{Used: len(repos), Limit: application.LimitsForPlan(plan).MaxReposPerProject},
		"plan":                  plan,
		"allow_cross_repo_read": crossRead,
	}, nil
}

func (s *Server) listProjectRepos(c *gin.Context) {
	id := c.Param("id")
	if !s.requireProjectAccess(c, id) {
		return
	}
	payload, err := s.reposPayload(c, id)
	if err != nil {
		s.mapRepoErr(c, err)
		return
	}
	c.JSON(200, payload)
}

func (s *Server) addProjectRepo(c *gin.Context) {
	id := c.Param("id")
	if !s.requireTicketWrite(c, id) {
		return
	}
	var body application.RepoInput
	if err := c.BindJSON(&body); err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad json")
		return
	}
	repo, err := s.Store.AddProjectRepo(c.Request.Context(), id, body)
	if err != nil {
		s.mapRepoErr(c, err)
		return
	}
	if org, _, err := s.Store.PrimaryOrg(c.Request.Context(), c.GetString("userID")); err == nil {
		s.writeAudit(c, org.ID, "", "repo_connected", id, map[string]any{"repo": repo.FullName})
	}
	c.JSON(201, gin.H{"repo": repo})
}

func (s *Server) patchProjectRepo(c *gin.Context) {
	id := c.Param("id")
	if !s.requireTicketWrite(c, id) {
		return
	}
	var body application.RepoInput
	if err := c.BindJSON(&body); err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad json")
		return
	}
	repo, err := s.Store.UpdateProjectRepo(c.Request.Context(), id, c.Param("repoId"), body)
	if err != nil {
		s.mapRepoErr(c, err)
		return
	}
	c.JSON(200, gin.H{"repo": repo})
}

func (s *Server) deleteProjectRepo(c *gin.Context) {
	id := c.Param("id")
	if !s.requireTicketWrite(c, id) {
		return
	}
	if err := s.Store.DeleteProjectRepo(c.Request.Context(), id, c.Param("repoId")); err != nil {
		s.mapRepoErr(c, err)
		return
	}
	c.Status(204)
}

// setActiveProjectRepos picks which repos keep routing after a downgrade (S-13 vZyTd).
func (s *Server) setActiveProjectRepos(c *gin.Context) {
	id := c.Param("id")
	if !s.requireTicketWrite(c, id) {
		return
	}
	var body struct {
		Keep []string `json:"keep"`
	}
	if err := c.BindJSON(&body); err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad json")
		return
	}
	if _, err := s.Store.SetActiveRepos(c.Request.Context(), id, body.Keep); err != nil {
		s.mapRepoErr(c, err)
		return
	}
	payload, err := s.reposPayload(c, id)
	if err != nil {
		s.mapRepoErr(c, err)
		return
	}
	c.JSON(200, payload)
}

func (s *Server) patchRepoSettings(c *gin.Context) {
	id := c.Param("id")
	if !s.requireTicketWrite(c, id) {
		return
	}
	var body struct {
		AllowCrossRepoRead *bool `json:"allow_cross_repo_read"`
	}
	if err := c.BindJSON(&body); err != nil || body.AllowCrossRepoRead == nil {
		writeErr(c, 400, "INVALID_INPUT", "allow_cross_repo_read required")
		return
	}
	if err := s.Store.SetCrossRepoRead(c.Request.Context(), id, *body.AllowCrossRepoRead); err != nil {
		s.mapRepoErr(c, err)
		return
	}
	payload, err := s.reposPayload(c, id)
	if err != nil {
		s.mapRepoErr(c, err)
		return
	}
	c.JSON(200, payload)
}

// uncoveredPlatforms returns reporter counts on platforms the ticket's repo does not serve (US-55).
func (s *Server) uncoveredPlatforms(c *gin.Context, t application.Ticket) (covered, uncovered map[string]int) {
	covered, uncovered = map[string]int{}, map[string]int{}
	byPlatform, err := s.Store.TicketPlatforms(c.Request.Context(), t.ID)
	if err != nil || !t.RepoID.Valid {
		return byPlatform, uncovered
	}
	served, err := s.Store.RepoServesPlatforms(c.Request.Context(), t.ProjectID, t.RepoID.String)
	if err != nil {
		return byPlatform, uncovered
	}
	for p, n := range byPlatform {
		if served[p] {
			covered[p] = n
		} else {
			uncovered[p] = n
		}
	}
	return covered, uncovered
}

func platformList(m map[string]int) []string {
	out := make([]string, 0, len(m))
	for _, p := range application.RepoPlatforms {
		if m[p] > 0 {
			out = append(out, p)
		}
	}
	return out
}

func labelList(platforms []string) string {
	labels := make([]string, 0, len(platforms))
	for _, p := range platforms {
		labels = append(labels, application.PlatformLabel(p))
	}
	return strings.Join(labels, ", ")
}
